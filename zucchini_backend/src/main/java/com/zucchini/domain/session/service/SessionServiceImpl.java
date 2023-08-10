package com.zucchini.domain.session.service;

import com.zucchini.domain.conference.domain.Conference;
import com.zucchini.domain.conference.repository.ConferenceRepository;
import com.zucchini.domain.reservation.domain.Reservation;
import com.zucchini.domain.reservation.repository.ReservationRepository;
import com.zucchini.domain.session.dto.request.LeaveSessionRequest;
import com.zucchini.domain.session.dto.response.SessionResponse;
import com.zucchini.domain.user.domain.User;
import com.zucchini.domain.user.repository.UserRepository;
import com.zucchini.domain.video.dto.request.AddVideoRequest;
import com.zucchini.domain.video.service.VideoService;
import io.openvidu.java.client.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.core5.http.HttpResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpSession;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
@RequiredArgsConstructor
public class SessionServiceImpl implements SessionService {


    private ConferenceRepository conferenceRepository;
    private ReservationRepository reservationRepository;
    private UserRepository userRepository;
    private VideoService videoService;

    private OpenVidu openVidu;
    private Map<Integer, Session> mapSessions = new ConcurrentHashMap<>();
    // Collection to pair session names and tokens (the inner Map pairs tokens and
    // role associated)
    private Map<Integer, Map<String, OpenViduRole>> mapSessionNamesTokens = new ConcurrentHashMap<>();
    // 컨퍼런스 넘버에 대한 아이디에 대한 토큰 받아오는 역할
    private Map<Integer, Map<String, String>> mapSessionIdTokens = new ConcurrentHashMap<>();
    // 현재 세션 아이디
    private String curSessionId;
    // 세션 녹화 여부?
    private Map<String, Boolean> sessionRecordings = new ConcurrentHashMap<>();

//    @Value("${openvidu.url}")
    private String OPENVIDU_URL;
    // Secret shared with our OpenVidu server
//    @Value("${openvidu.secret}")
    private String SECRET;

    private final long thirtyMillis = 30 * 60 * 1000; // 30분

    @Autowired
    public SessionServiceImpl(@Value("${openvidu.secret}") String secret, @Value("${openvidu.url}") String openviduUrl, ConferenceRepository conferenceRepository,
                              ReservationRepository reservationRepository, UserRepository userRepository, RedisTemplate<String, String> redisTemplate) {
        this.conferenceRepository = conferenceRepository;
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.SECRET = secret;
        this.OPENVIDU_URL = openviduUrl;
        this.openVidu = new OpenVidu(OPENVIDU_URL, SECRET);
//        this.redisTemplate = redisTemplate;
    }

    /**
     * 컨퍼런스에 대한 활성화된 세션이 있는지 확인 -> 없으면 새로 생성, 있으면 조회만
     * @param no
     * @param httpSession
     * @param response
     * @return
     * @throws OpenViduJavaClientException
     * @throws OpenViduHttpException
     */
    @Override
    public SessionResponse findConferenceSession(int no, HttpSession httpSession, HttpResponse response)
            throws OpenViduJavaClientException, OpenViduHttpException {
        log.info("no========================="+ no);
        Optional<Conference> conference = conferenceRepository.findById(no);
        // 없는 컨퍼런스면 예외 처리
        if(!conference.isPresent()) throw new NoSuchElementException("컨퍼런스가 없습니다.");

        String userId = getCurrentId();
        User user = userRepository.findById(userId).get();
        List<Reservation> reservationList = reservationRepository.findByConferenceNoAndUser(no, user);
        // 해당 컨퍼런스에 접근 권한이 없는 회원인 경우 예외 처리
        if(reservationList.size() == 0) throw new IllegalArgumentException("권한이 없습니다");
        if(!conference.get().isActive()) {
            // 컨퍼런스 세션 활성화
            conference.get().setActive();
            conferenceRepository.save(conference.get());
        }
        // 해당 컨퍼런스 번호로 한 예약은 회원마다 유일함
        Reservation reservation = reservationList.get(0);
//        if(reservation.isAttended()){
//            // 이미 접속중인 상태
//            throw new IllegalArgumentException("이미 해당 컨퍼런스에 접속한 상태입니다.");
//        }
        // 예약된 날짜부터 30분까지는 입장 가능하게 변경(임시)
//        Date curDate = new Date();
//        if(curDate.getTime()-conference.get().getConfirmedDate().getTime() > thirtyMillis)
//            throw new IllegalArgumentException("입장 만료되었습니다.");
        // 회원의 참석 여부 true로 갱신
        reservation.attend();
        reservationRepository.save(reservation);

        OpenViduRole role = OpenViduRole.PUBLISHER;

        String token = getToken(user, role, no, httpSession);
        if(token == ""){
            // 사용자 토큰 발급 문제!!!! 현재 세션에 아무도 있지 않다고 판단하고 새로 세션을 생성
            this.mapSessions.remove(no);
            //한번더 토큰발급 진행
            token = getToken(user, role, no, httpSession);
        }
        // 컨퍼런스에 판매자 구매자 모두 접속한 경우 -> 동영상 녹화 시작!!
        if(getAttendedUserCount(no) == 1){
            // 일단은 오디오 비디오 모두 true인 것으로 설정
            startRecording(curSessionId, true, true);
        }

        return new SessionResponse(role, token, user.getNickname());
    }

    /**
     * 녹화 시작
     */
    private void startRecording(String sessionId, boolean hasAudio, boolean hasVideo) throws OpenViduJavaClientException, OpenViduHttpException {
        // 둘다 녹화함
        Recording.OutputMode outputMode = Recording.OutputMode.COMPOSED;
        RecordingProperties properties = new RecordingProperties.Builder().outputMode(outputMode).hasAudio(hasAudio)
                .hasVideo(hasVideo).build();
        Recording recording = this.openVidu.startRecording(sessionId, properties);
        this.sessionRecordings.put(sessionId, true);
    }

    /**
     * 녹화 종료
     * @param recordingId : 참여중인 세션 아이디
     */
    private void stopRecording(String recordingId, int itemNo) throws OpenViduJavaClientException, OpenViduHttpException {

        System.out.println("Stoping recording | {recordingId}=" + recordingId);

        Recording recording = this.openVidu.stopRecording(recordingId);
        this.sessionRecordings.remove(recording.getSessionId());
        // 받은 비디오 url 링크를 db에 저장
        AddVideoRequest addVideoRequest = new AddVideoRequest();
        addVideoRequest.setItemNo(itemNo);
        addVideoRequest.setLink(recording.getUrl());
        addVideoRequest.setStartTime(new Date(recording.getCreatedAt()));
        addVideoRequest.setEndTime(new Date());
        // video 서비스 호출
        videoService.addVideo(addVideoRequest);
    }

    /**
     * 현재 세션에 접속중인 사용자가 몇명인지 반환하는 함수(본인 제외)
     * @param no : 컨퍼런스 번호
     * @return
     */
    private int getAttendedUserCount(int no){
        // 컨퍼런스에 참석중인 사람이 몇명인지 확인
        int cnt = 0;
        User user = userRepository.findById(getCurrentId()).get();
        List<Reservation> reservationList = reservationRepository.findByConferenceNo(no);
        // 한 컨퍼런스에 예약은 판매자 구매자 이렇게 2개만 가능
        for (int i = 0; i < 2; i++) {
            if(reservationList.get(i).isAttended() && reservationList.get(i).getUser().getNo() != user.getNo()){
                // 자기 자신 제외
                cnt++;
            }
        }
        return cnt;
    }

    /**
     * 세션 연결 종료 시 남은 인원 확인 후 세션 완전히 종료할지 설정
     * @param leaveSessionRequest
     */
    @Override
    public void leaveConferenceSession(LeaveSessionRequest leaveSessionRequest) {
        int no = leaveSessionRequest.getConferenceNo();
        String token = leaveSessionRequest.getToken();
        log.info("no========================="+ no);
        // 쿼리 최적화 하려면...?
        Optional<Conference> conference = conferenceRepository.findById(no);
        // 없는 컨퍼런스면 예외 처리
        if(!conference.isPresent()) throw new NoSuchElementException("컨퍼런스가 없습니다.");
        if(!conference.get().isActive()) throw new IllegalArgumentException("컨퍼런스가 아직 활성화되지 않은 상태입니다.");

        String userId = getCurrentId();
        User user = userRepository.findById(userId).get();
        List<Reservation> reservationList = reservationRepository.findByConferenceNoAndUser(no, user);

        // 해당 컨퍼런스에 접근 권한이 없는 회원인 경우 예외 처리
        if(reservationList.size() == 0) throw new IllegalArgumentException("권한이 없습니다");

        // 토큰 유효성 검사
        if (this.mapSessionNamesTokens.get(no).remove(token) == null) throw new IllegalArgumentException("토큰이 잘못되었습니다.");
        // 자기 자신의 예약
        Reservation reservation = reservationList.get(0);
        // 컨퍼런스에 참석중인 사람이 몇명인지 확인
        int cnt = getAttendedUserCount(no);
        log.info("방에 참여중인 사람 수 ->>>>>>>>{}", cnt);
        if(cnt == 0){
            this.mapSessions.remove(no);
            // 토큰삭제도 필요~~
                this.mapSessionNamesTokens.remove(no);
                this.mapSessionIdTokens.remove(no);
            // 예약된 날짜부터 30분까지는 입장 가능하게 변경(임시)
//            Date curDate = new Date();
//            // 본인이 퇴장 시 아무도 세션에 참가하지 않게 됨 -> 세션 삭제
//            if(curDate.getTime()-conference.get().getConfirmedDate().getTime() > thirtyMillis) {
//                this.mapSessions.remove(no);
//                // 토큰삭제도 필요~~
//                this.mapSessionNamesTokens.remove(no);
//                this.mapSessionIdTokens.remove(no);
//            }
            // 일단 둘다 종료시 컨퍼런스도 종료되게 구현? -> 컨퍼런스 비활성화 관련 고민(실수로 둘다 종료된 경우는?)
//            conferenceRepository.delete(conference.get());
            // 세션이 종료되었으므로 녹화 중단 후 저장
//            stopRecording();
        }

        // 회원의 접속 여부 false로 갱신
        reservation.leave();
        reservationRepository.save(reservation);
    }


    private String getToken(User user, OpenViduRole role, int no, HttpSession httpSession) throws OpenViduJavaClientException, OpenViduHttpException {
        String serverData = "{\"serverData\": \"" + user.getNickname() + "\"}";
        System.out.println("serverData : "+serverData);

        ConnectionProperties connectionProperties = new ConnectionProperties.Builder().type(ConnectionType.WEBRTC)
                .role(role).data(serverData).build();

        String token = "";

        // 검색하는 방이 존재하지 않을 경우
        if (this.mapSessions.get(no) == null) {
            // session 값 생성
            log.info("openvidu==============={}", this.openVidu);
            Session session = this.openVidu.createSession();
            log.info("방이 없는 경우에 진입 roomId: {}, sessionId: {}", no,session.getSessionId());
            try{
                token = session.createConnection(connectionProperties).getToken();
                // 방 관리 map에 저장 roomId랑 들어온 유저 저장
                this.mapSessions.put(no, session);
                this.mapSessionNamesTokens.put(no, new ConcurrentHashMap<>());
                this.mapSessionNamesTokens.get(no).put(token, role);

                Map<String, String> map = new ConcurrentHashMap<>();
                map.put(getCurrentId(), token);
                this.mapSessionIdTokens.put(no, map);
            }catch (Exception e){
                httpSession.setAttribute("error",e);
            }
        }else{
            log.info("방이 있는 경우에 진입 roomId: {}, sessionId: {}", no, mapSessions.get(no).getSessionId());
            try{
                token = this.mapSessions.get(no).createConnection(connectionProperties).getToken();
                this.mapSessionNamesTokens.get(no).put(token, role);
                this.mapSessionIdTokens.get(no).put(getCurrentId(), token);
//                if(this.mapSessionIdTokens.get(no).get(getCurrentId()) != null) {
//                    token = this.mapSessionIdTokens.get(no).get(getCurrentId());
//                }else {
//                    token = this.mapSessions.get(no).createConnection(connectionProperties).getToken();
//                    this.mapSessionNamesTokens.get(no).put(token, role);
//                    this.mapSessionIdTokens.get(no).put(getCurrentId(), token);
//                }
            }catch (Exception e){
                httpSession.setAttribute("error",e);
            }
        }
        System.out.println("token :"+ token );
        return token;
    }



    /**
     * 스프링 시큐리티 인증을 통과하여 저장된 회원의 인증 객체에서 아이디 추출
     * @return String : 아이디
     */
    private String getCurrentId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetails principal = (UserDetails) authentication.getPrincipal();
        return principal.getUsername();
    }

}
