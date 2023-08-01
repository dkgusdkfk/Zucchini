import styled from "styled-components";
import ChatRoomEach from "../components/List/ChatRoomEach";
import { useState, useEffect } from "react";
import axios from "axios";
import Loading from "../components/Loading/Loading";

interface Item {
  id: number;
}

export default function ChatList() {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Item[] | null>(null);

  useEffect(() => {
    setIsLoading(true);

    axios
      .get("http://localhost:8080/api/mypage/chat")
      .then((res) => setData(res.data))
      .catch((error) => console.log(error));
  }, []);

  useEffect(() => {
    if (data) {
      setIsLoading(false);
    }
    setIsLoading(false);
  }, [data]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <ContainerDiv>
      {/* <TitleSpan>나의 채팅 목록</TitleSpan> */}
      <ChatListDiv>
        <TitleDiv>
          <TitleSpan>채팅 목록</TitleSpan>
        </TitleDiv>
        {/* 통신합시다^^ */}
        {[1, 2, 3, 4, 5, 6, 7].map((e, i) => (
          <ChatRoomEach
            chat={{
              img: "물건물건 이미지 쏘오쓰",
              sender: "거래자",
              senderGrade: "거래자 등급",
              lastMsg: "lastMessage",
              lastMsgTime: "12:00",
              unread: "1",
            }}
          />
        ))}
      </ChatListDiv>
    </ContainerDiv>
  );
}
const ContainerDiv = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5rem;
  margin: 0 6rem 13rem 6rem;
  font-family: "IBM Plex Sans KR", sans-serif;
`;

const TitleSpan = styled.span`
  font-size: 1.4rem;
`;

const ChatListDiv = styled.div`
  height: 40rem;
  width: 37rem;
  padding: 3rem;
  box-shadow: rgba(0, 0, 0, 0.25) 0px 14px 28px,
    rgba(0, 0, 0, 0.22) 0px 10px 10px;
  overflow-y: auto;

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

const TitleDiv = styled.div`
  padding: 1rem 0;
`;
