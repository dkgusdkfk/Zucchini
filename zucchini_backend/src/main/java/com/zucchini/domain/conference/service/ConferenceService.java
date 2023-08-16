package com.zucchini.domain.conference.service;

import com.zucchini.domain.conference.dto.FindConferenceResponse;

import java.util.Date;

public interface ConferenceService {

    /**
     * 회의 생성
     *
     * @param itemNo      : 아이템 번호
     * @param confirmDate : 화상 회의 확정 날짜
     * @return int : 생성된 회의의 번호
     */
    int addConference(int itemNo, Date confirmDate);


    /**
     * 회의 조회
     *
     * @param conferenceNo : 회의 번호
     * @return FindConferenceResponse : 회의 정보 반환
     */
    FindConferenceResponse findConference(int conferenceNo);

    /**
     * 회의 상품 번호 조회
     *
     * @param conferenceNo : 회의 번호
     * @return FindConferenceResponse : 회의 상품 번호 반환
     */
    int findConferenceItemNo(int conferenceNo);

    /**
     * 회의 삭제
     *
     * @param conferenceNo : 회의 번호
     */
    void removeConference(int conferenceNo);

    /**
     * 판매자의 예약 취소
     *
     * @param conferenceNo : 회의 번호
     */
    void cancelConference(int conferenceNo);

}
