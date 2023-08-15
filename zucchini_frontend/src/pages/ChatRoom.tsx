import SimpleCalendar from "../components/Schedule/SimpleCalendar";
import styled from "styled-components";
import female from "../assets/images/female.jpg";
import Modal from "../components/Common/Modal";
import { useEffect, useRef, useState } from "react";
import Chatting from "../components/Chat/Chatting";
import ClosedButton from "../components/Button/ClosedButton";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useLocation } from "react-router";
import { useForm } from "react-hook-form";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import Imessage from "../types/Imessage";
import { motion } from "framer-motion";
import { getUser } from "../hooks/useLocalStorage";
import api from "../utils/api";
import Report from "../components/Common/Report";
import GradeImage from "../components/Common/GradeImage";
import GradeText from "../components/Common/GradeText";

interface ISeller {
  nickname: string;
  grade: number;
}

interface IDate {
  date: string;
  status: number;
}

interface IItem {
  no: number;
  title: string;
  price: number;
  image: string;
  seller: ISeller;
  dateList: IDate[];
}
interface OpponentInfo {
  opponentNickname: string;
  opponentGrade: string;
}

export default function ChatRoom() {
  const [isOpen, setIsOpen] = useState(false);
  const [isReporting, setIsReporting] = useState(false); // 신고모달
  const [opponent, setOpponent] = useState<OpponentInfo>();

  const toggleReport = () => {
    setIsReporting(!isReporting);
  };
  const reportReasons = [
    "거래 / 환불 분쟁 신고",
    "사기 ",
    "전문판매업자",
    "욕설, 비방",
    "성희롱",
  ];

  const [user, setUser] = useState({
    no: 0,
    nickname: "",
  });

  const [item, setItem] = useState<IItem>();

  const { register, handleSubmit, reset } = useForm();

  const [messages, setMessages] = useState<Imessage[]>([]);
  const { no } = useParams();
  const chatMainDivRef = useRef<HTMLDivElement>(null);

  // messages 배열이 변경될 때마다 스크롤을 맨 아래로 이동
  useEffect(() => {
    if (chatMainDivRef.current) {
      chatMainDivRef.current.scrollTop = chatMainDivRef.current.scrollHeight;
    }
  }, [messages]);

  const location = useLocation();
  // 아이템 가져오기
  useEffect(() => {
    const getItem = async () => {
      try {
        const response = await api.get(
          `/room/item/${location.pathname.split("/chat/")[1]}`
        );
        setItem(response.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    getItem();
  }, []);

  // 상대방 정보 불러오기 룸넘버 넘겨줘야함
  useEffect(() => {
    const getOpponent = async () => {
      await api
        .get(`room/user/${no}`)
        .then((response) => setOpponent(response.data));
    };
    getOpponent();
  }, []);

  const onSubmit = async (data: any) => {
    if (!client.current) return;
    if (data.content === "") return;

    client.current.publish({
      destination: "/pub/chat",
      // headers: {
      //   Authorization: `Bearer ${localStorage.getItem("token")}`,
      // },
      body: JSON.stringify({
        roomNo: no,
        senderNo: user.no,
        content: data.content,
      }),
    });

    // 로그인 기능 구현되면 밑에 주석 풀기 (DB에 저장하는 코드)

    // try {
    //   const response = await axios.post("http://localhost:8080/api/room", {
    //     roomNo: apply_id,
    //     content: data.content,
    //   });
    // } catch (error) {
    //   console.log(error);
    // }
    reset();
  };

  async function getUserInformation() {
    const response = await api.get("/user/findMyNo");
    setUser(response.data);
    console.log(user.no); // 왜 0뜸? 모름
    console.log(user.nickname); // 마찬가지
  }

  async function getMessageList() {
    const response = await api.get(`/room/${no}/message`);
    setMessages(response.data);
    messages.map((message) => console.log(message.read));
  }

  const { apply_id } = useParams();
  const client = useRef<Client | null>(null);

  const subscribe = () => {
    if (!client.current) return;
    // client.current.subscribe("/sub/chat/" + apply_id, (body) => { 현재 방번호까지 구현 되면 진행하기 (로그인이 되야 됨)
    client.current.subscribe("/sub/chat/" + no, (body) => {
      const json_body = JSON.parse(body.body);
      console.log(json_body);
      setMessages((prevMessages) => [...prevMessages, json_body]);
    });

    // 읽음 상태 변경 구독
    client.current.subscribe("/sub/chat/readStatus/" + no, () => {
      setMessages((prevMessages) =>
        prevMessages.map((message) => ({
          ...message,
          read: true, // 상태를 읽음으로 변경
        }))
      );
    });
  };

  const connect = () => {
    if (!no) return;
    console.log("연결이 성공적으로 수행되었습니다.");
    client.current = new Client({
      brokerURL: "ws://localhost:8080/api/ws",
      onConnect: () => {
        subscribe();
      },
      connectHeaders: {
        Authorization: `Bearer ${getUser()}`,
        headerNo: no, // 방 번호 추가
      },
    });
    client.current.activate();
  };

  const disconnect = () => {
    if (!client.current) return;
    client.current.deactivate();
  };

  useEffect(() => {
    console.log(getUser());
    getUserInformation();
    connect();

    return () => disconnect();
  }, []);

  useEffect(() => {
    getMessageList();
  }, []);

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  const [buyOpen, setBuyOpen] = useState(false);

  const buyToggle = () => {
    setBuyOpen(!buyOpen);
  };

  const navigate = useNavigate();
  const moveItem = () => {
    navigate(`/item/${item?.no}`);
  };

  // 예약중으로 상태변경
  const nextStatus = async () => {
    await api.put(`/item/${item?.no}/deal`).then();
  };

  return (
    <ContainerDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Modal isOpen={buyOpen} toggle={buyToggle}>
        <ModalDiv>
          <ClosedButton onClick={buyToggle} />
        </ModalDiv>
        <ModalSpan>거래 예약하기</ModalSpan>
        <SpanDiv>
          <span>지금 채팅 중인 분과 거래 하시겠습니까?</span>
          <span>
            확인 버튼을 누르시면 해당 상품이 '예약중' 상태로 변경됩니다.
          </span>
        </SpanDiv>
        <ButtonDiv>
          <GreenBtn onClick={nextStatus}>
            <Link to={"/mypage/buy"}>확정</Link>
          </GreenBtn>
        </ButtonDiv>
      </Modal>
      <Modal isOpen={isOpen} toggle={toggle}>
        <ModalDiv>
          <ClosedButton onClick={toggle} />
        </ModalDiv>
        <ModalSpan>화상통화 일정 선택</ModalSpan>
        <ModalSubSpan>
          <SubSpan>일정은 하루만 선택 가능합니다</SubSpan>
        </ModalSubSpan>
        <SimpleCalendar dates={item?.dateList as IDate[]} />
      </Modal>
      <Modal isOpen={isReporting} toggle={toggleReport}>
        <ModalDiv>
          <ClosedButton onClick={toggleReport} />
        </ModalDiv>
        <ModalSpan>신고하기</ModalSpan>
        <SubSpan>신고 사유를 선택해주세요.</SubSpan>
        <Report
          reportedNickname={item?.seller.nickname}
          itemNo={item?.no}
          reasons={reportReasons}
          roomNo={null}
          onCancel={toggleReport}
        />
      </Modal>
      <BodyDiv>
        <LeftDiv>
          <UpperDiv>
            <TitleSpan>판매자가 선택한 일정</TitleSpan>
            <SimpleCalendar dates={item?.dateList as IDate[]} />
            <StyledBtnDiv>
              <StyledBtn>
                <Link to={"/scheduleList"}>영상 통화하기</Link>
              </StyledBtn>
              <StyledBtn onClick={toggle}>일정 선택하기</StyledBtn>
            </StyledBtnDiv>
          </UpperDiv>
          <LowerDiv>
            {/* 채팅방 상대방 정보를... */}

            <SellerTitle>상대방 정보</SellerTitle>
            <SellerDiv>
              {/* <SellerImg src={female}></SellerImg> */}
              <SellerSpanDiv>
                <SellerName>{opponent?.opponentNickname}</SellerName>
                {/* <span>Lv.1 애호박씨앗</span> */}
                <span>Lv.{opponent?.opponentGrade}</span>
                {/* <SubSpan>판매중 3 · 거래완료 2</SubSpan> */}
              </SellerSpanDiv>
              <BtnDiv>
                <ReportBtn onClick={toggleReport}>신고하기</ReportBtn>
                {opponent?.opponentNickname !== item?.seller.nickname && (
                  <SellerBtn onClick={buyToggle}>거래 예약</SellerBtn>
                )}
              </BtnDiv>
            </SellerDiv>
          </LowerDiv>
        </LeftDiv>
        <RightDiv>
          <ChatTitleDiv onClick={moveItem}>
            <ChatImg src={item?.image}></ChatImg>
            <ChatDiv>
              <SellerName>{item?.title}</SellerName>
              <SubSpan>{item?.price.toLocaleString("ko-KR")}원</SubSpan>
            </ChatDiv>
            <SvgDiv>
              <Svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                />
              </Svg>
              <Svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.7y5 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
                />
              </Svg>
            </SvgDiv>
          </ChatTitleDiv>
          <ChatMainDiv ref={chatMainDivRef}>
            {messages.map((message, index) => (
              <Chatting
                message={message}
                isUser={message.senderNo === user.no}
              />
            ))}
          </ChatMainDiv>
          <ChatInputDiv>
            <Svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
              />
            </Svg>
            <StyledForm onSubmit={handleSubmit(onSubmit)}>
              <StyledInput
                {...register("content")}
                placeholder="메시지를 입력해주세요.."
              ></StyledInput>
              <SubmitBtn type="submit">
                {/* 제출 안되면 이부분 엎어야 함 */}
                <Svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                  />
                </Svg>
              </SubmitBtn>
            </StyledForm>
          </ChatInputDiv>
        </RightDiv>
      </BodyDiv>
    </ContainerDiv>
  );
}

const ContainerDiv = styled(motion.div)`
  display: flex;
  flex-direction: column;
  padding: 0 5rem;
  margin: 0 6rem 13rem 6rem;
  font-family: "IBM Plex Sans KR", sans-serif;
`;

const StyledSvg = styled.svg`
  height: 1.5rem;
  width: 1.5rem;
  cursor: pointer;
  color: #849c80;
`;

const BodyDiv = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  padding: 2rem;
`;

const LeftDiv = styled.div``;

const BtnDiv = styled.div`
  display: flex;
  flex-direction: column;
  padding-top: 1rem;
`;

const RightDiv = styled.div`
  width: 40rem;
  padding-left: 2rem;
`;

const UpperDiv = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
`;

const LowerDiv = styled.div`
  padding-top: 2rem;
`;

const TitleSpan = styled.span`
  font-size: 1.4rem;
  font-weight: 600;
  margin: 1.5rem 0;
`;

const StyledBtnDiv = styled.div`
  display: flex;
  width: 19rem;
  flex-direction: column;
  margin-top: 1.3rem;
  gap: 0.5rem;
`;

const StyledBtn = styled.button`
  height: 2.7rem;
  background-color: #cde990;
  border: solid 2px #cde990;
  border-radius: 0.4rem;
  cursor: pointer;
  margin-right: 0.4rem;
  font-size: 1rem;

  &:hover {
    background-color: white;
  }
`;

const ModalBtn = styled.button`
  width: 9rem;
  height: 2.5rem;
  background-color: #cde990;
  border: solid 1px #cde990;
  border-radius: 0.4rem;
  cursor: pointer;
  margin-right: 0.4rem;
  margin-top: 2rem;

  &:hover {
    background-color: white;
  }
`;
const SellerDiv = styled.div`
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
`;

const SellerImgDiv = styled.div`
  width: 8rem;
  height: 6.5rem;
  border-radius: 5rem;
  border: solid 3px #cde990;
  margin-top: 1rem;
  display: flex;
  justify-content: center;
`;

const SellerSpanDiv = styled.div`
  width: 50%;
  display: flex;
  flex-direction: column;
  padding-left: 1rem;
  gap: 0.8rem;
  padding-top: 0.8rem;
`;

const SellerTitle = styled.span`
  font-size: 1.3rem;
  margin-bottom: 0.3rem;
`;

const SellerName = styled.span`
  font-weight: 700;
`;

const SubSpan = styled.span`
  color: gray;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
`;

const ModalSubSpan = styled.div`
  margin-bottom: 1rem;
`;

const ModalDiv = styled.div`
  float: right;
`;

const ModalSpan = styled.div`
  font-size: 1.8rem;
  font-weight: 600;
  margin-top: 3rem;
  margin-bottom: 0.5rem;
`;

const ChatTitleDiv = styled.div`
  height: 4rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1rem;
  background-color: #f3f3f3;
`;

const ChatMainDiv = styled.div`
  height: 32rem;
  background-color: #cccccc;
  overflow-y: scroll;
  padding: 1rem;

  /* 스크롤바의 스타일 지정 */
  &::-webkit-scrollbar {
    width: 8px; /* 스크롤바의 너비 */
    background-color: #e8e2d9; /* 스크롤바의 배경색 */
  }

  /* 스크롤바의 thumb 스타일 지정 */
  &::-webkit-scrollbar-thumb {
    background-color: #acb4a8; /* 스크롤바 thumb 색상 */
    border-radius: 3px; /*스크롤바 thumb의 모서리 둥글기*/
  }

  /* 스크롤바의 thumb에 호버했을 때 스타일 지정 */
  &::-webkit-scrollbar-thumb:hover {
    background-color: #818a7e; /* 스크롤바 thumb 호버 색상 */
  }

  /* 스크롤바의 thumb에 클릭했을 때 스타일 지정 */
  &::-webkit-scrollbar-thumb:active {
    background-color: #656c62; /* 스크롤바 thumb 클릭 색상 */
  }
`;

const ChatInputDiv = styled.div`
  height: 3rem;
  display: flex;
  /* justify-content: space-between; */
  align-items: center;
  padding: 0 0.7rem;
  background-color: #f3f3f3;
`;

const SvgDiv = styled.div`
  display: flex;
  justify-content: space-between;
  width: 3.5rem;
`;

const Svg = styled.svg`
  width: 24px;
  height: 24px;
  color: #006aff;
`;

const ChatImg = styled.img`
  height: 3rem;
  width: 3rem;
  border: solid 1px black;
  border-radius: 4rem;
`;

const ChatDiv = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 29rem;
  padding-top: 0.5rem;
  gap: 0.4rem;
`;

const StyledInput = styled.input`
  width: 33rem;
  height: 2rem;
  padding: 0 0.7rem;
  background-color: transparent;
  border: transparent;
  border-radius: 0.4rem;
  font-size: 1rem;

  &:focus {
    /* box-shadow: 0 0 10px #9ec4f2; */
    outline: none;
    background-color: white;
  }
`;

const SellerBtn = styled.button`
  height: 2rem;
  width: 5.6rem;
  border-radius: 0.3rem;
  border: solid 2px #88a44c;
  background-color: #cde990;
  letter-spacing: 0.1rem;
  margin: 0.2rem;
  cursor: pointer;

  &:hover {
    background-color: white;
  }
`;

const ReportBtn = styled.button`
  height: 2rem;
  width: 5.6rem;
  border-radius: 0.3rem;
  border: solid 2px tomato;
  background-color: white;
  letter-spacing: 0.1rem;
  margin: 0.2rem;
  cursor: pointer;

  &:hover {
    background-color: #ffd4d4;
  }
`;

const SpanDiv = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1.1rem 0 2rem 0;
`;

const ButtonDiv = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
`;

const GreenBtn = styled.button`
  width: 16rem;
  height: 2.8rem;
  border-radius: 0.4rem;
  background-color: #cde990;
  border: solid 2px #cde990;
  color: white;
  font-size: 1rem;
  cursor: pointer;

  &:hover {
    background-color: white;
    border: solid 2px #cde990;
    color: #cde990;
  }
`;

const SubmitBtn = styled.button`
  border: transparent;
  background-color: transparent;
  padding-left: 0.5rem;
  padding-top: 0.3rem;
`;

const StyledForm = styled.form`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  margin-left: 0.5rem;
`;

const GradeDiv = styled.div`
  display: flex;
  gap: 0.5rem;
`;
