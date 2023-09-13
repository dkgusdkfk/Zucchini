import styled from "styled-components";
import Modal from "../components/Common/Modal";
import { useEffect, useState } from "react";
import SimpleCalendarRegister from "../components/Schedule/SimpleCalendarRegister";
// import ImageUpload from "../FileUpload/ImageUpload";
import DragDrop from "../FileUpload/DragDrop";
import { useForm } from "react-hook-form";
import { ErrorMessage } from "@hookform/error-message";
import ClosedButton from "../components/Button/ClosedButton";
import dayjs from "dayjs";
import axios from "axios";
import IFileTypes from "../types/IFileTypes";
import { Button } from "../components/Common/Button";
import useAuth from "../hooks/useAuth";
import { motion } from "framer-motion";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Credentials } from "aws-sdk";
import { v1, v3, v4, v5 } from "uuid";
import api from "../utils/api";
import { useNavigate } from "react-router";
import { BASE_URL } from "../constants/url";

export default function CreateItem() {
  // sdk-s3
  /*
   * 실제 AWS 액세스 키와 시크릿 키로 대체해야 합니다.
   * 이렇게 설정하면 AWS 서비스에 액세스하기 위한 인증 정보가 제공되어
   * "Credential is missing" 에러가 해결될 것입니다.
   * 액세스 키와 시크릿 키를 코드에 하드코딩하는 것은 보안상 좋지 않을 수 있으므로,
   * 실제 프로덕션 환경에서는 환경 변수나 다른 보안 메커니즘을 사용하여 안전하게 관리하는 것이 좋습니다.
   */
  const [uploadURL, setUploadURL] = useState("");
  //@ts-ignore
  const credentials: Credentials = {
    accessKeyId: "",
    secretAccessKey: "",
  };
  const client = new S3Client({
    region: "ap-northeast-2",
    credentials: credentials,
  });
  const uploadFile = async (file: IFileTypes) => {
    const uuid = v1().toString().replace("-", "");
    const keyName = `${uuid}.${file.object.name}`;

    const command = new PutObjectCommand({
      Bucket: "zucchinifile",
      Key: keyName,
      Body: file.object,
    });
    try {
      await client.send(command);

      // 이미지의 공개 URL 생성
      const imageURL = `https://zucchinifile.s3.ap-northeast-2.amazonaws.com/${keyName}`;
      return imageURL;
    } catch (err) {
      console.error(err);
    }
  };

  const token = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm({
    mode: "onChange",
  });

  const [isOpen, setIsOpen] = useState(false);

  const [files, setFiles] = useState<IFileTypes[]>([]);
  // 마우스로 선택한 날짜 받는 state
  const getNextNearest30Minutes = (time: Date) => {
    const minutes = time.getMinutes();

    // Calculate the difference between the current minutes and the next 30-minute mark
    const minutesUntilNext30 = 30 - (minutes % 30);

    // Add the difference to the current time to get the next nearest 30-minute time
    time.setMinutes(minutes + minutesUntilNext30);
    time.setSeconds(0);

    return time;
  };
  const [clickedTime, setClickedTime] = useState(
    getNextNearest30Minutes(new Date())
  );

  // 판매자가 선택한 시간들 차곡차곡 담아주기
  const [selectedTimes, setSelectedTimes] = useState<any>([]);
  // 카테고리 전부
  const [allCategories, setAllCategories] = useState<any>([]);
  // 선택한 카테고리
  const [selectedCategories, setSelectedCategories] = useState<any>([]);

  // 처음 렌더링될 때, 카테고리 가져올 거예영
  useEffect(() => {
    const getCategories = async () => {
      try {
        const response = await axios.get(BASE_URL + "item/category");
        // const response = await api.get("item/category");
        const categoryNames = response.data.map((item: any) => item.category);
        setAllCategories(categoryNames);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    getCategories();
  }, []);

  const toggle = () => {
    setIsOpen(!isOpen);
    console.log("눌려?");
  };

  // 카테고리 추가
  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCategory =
      event.target.options[event.target.selectedIndex].textContent;
    console.log(selectedCategory);
    if (!selectedCategories.includes(selectedCategory)) {
      setSelectedCategories([...selectedCategories, selectedCategory]);
    }
  };

  useEffect(() => {
    console.log(selectedCategories);
  }, [selectedCategories]);

  // 카테고리 삭제
  const discardCategory = (event: React.MouseEvent<HTMLButtonElement>) => {
    console.log(event.currentTarget.value);
    let reselect = selectedCategories.filter(
      (e: any) => e !== event.currentTarget.value
    );
    setSelectedCategories(reselect);
  };

  const addTime = () => {
    // 이미 해당 아이템에서 선택해서 넣어준 시간일 경우
    if (selectedTimes.includes(clickedTime)) {
      alert("이미 선택된 시간입니다");
      return;
    }
    // 중복 체크 통과하면 넣어준다.
    // 30분 반올림하는 것도 추가해야대여....
    // gmt??tlqkf...
    setSelectedTimes([...selectedTimes, clickedTime]);
  };

  // 선택한 시간 삭제
  const removeTime = (timeToRemove: Date) => {
    const updatedTimes = selectedTimes.filter(
      (time: Date) => time !== timeToRemove
    ); // 배열의 각 요소인 time(Date 객체)가 timeToRemove와 같지 않은지 검사
    // 같지 않다면 true, 같으면 false 반환
    // timeToRemove와 같지 않은 요소들만 남긴 새로운 배열 생성
    setSelectedTimes(updatedTimes); // 새로운 배열 업데이트
  };

  const navigate = useNavigate();
  //진짜 제출
  const onSubmit = async (data: any) => {
    console.log("등록등록");
    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("content", data.content);
    formData.append("price", data.price);
    // 카테고리
    for (let i = 0; i < selectedCategories.length; i++) {
      const num = allCategories.indexOf(selectedCategories[i]) + 1;
      formData.append("categoryList", `${num}`);
    }
    // 이미지 파일 url
    // await uploadFile(files[i]);
    // formData.append("imageList", uploadURL);
    const uploadedURLs = await Promise.all(files.map(uploadFile));

    // 업로드된 URL들을 formData에 추가
    uploadedURLs.forEach((url: any) => {
      formData.append("imageList", url);
    });

    // 일정들
    for (let i = 0; i < selectedTimes.length; i++) {
      formData.append("dateList", selectedTimes[i]);
    }

    const response = await api.post("/item", formData);
    const item_no = response.data;

    navigate(`/item/${item_no}`);
  };
  useEffect(() => {
    console.log(uploadURL);
  }, [uploadURL]);

  return (
    <ContainerAll
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Modal isOpen={isOpen} toggle={toggle}>
        <ModalDiv>
          <ClosedButton onClick={toggle} />
        </ModalDiv>
        <ModalSpan>화상통화 일정 선택</ModalSpan>
        <CalendarDiv>
          <SimpleCalendarRegister
            clickedTime={clickedTime}
            setClickedTime={setClickedTime}
            toggle={toggle}
          />
        </CalendarDiv>
        <TimeContainerDiv>
          {selectedTimes.map((selectedTime: Date) => {
            const formattedTime = dayjs(selectedTime).format(
              "YYYY년 MM월 DD일 HH시 mm분"
            );
            return (
              <TimeDiv key={formattedTime}>
                {formattedTime}
                {/* <TimeBtn> */}
                <TimeSvg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="red"
                  className="w-6 h-6"
                  onClick={() => removeTime(selectedTime)}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </TimeSvg>
                {/* </TimeBtn> */}
              </TimeDiv>
            );
          })}
        </TimeContainerDiv>
        <StyledBtn onClick={addTime}>추가</StyledBtn>
        <StyledBtn onClick={() => toggle()}>완료</StyledBtn>
      </Modal>
      {/* <TimeSchedule isOpen={timeOpen} toggle={timeToggle} /> */}
      <ContainerForm onSubmit={handleSubmit(onSubmit)}>
        <TitleSpan>내 물건 팔기</TitleSpan>
        <ContentDiv>
          <ContentSpan>제목</ContentSpan>
          <ContentInput
            {...register("title", {
              required: "제목을 입력해주세요.",
              maxLength: 80,
            })}
            maxLength={80}
          ></ContentInput>
          <StyledMessage>
            <ErrorMessage errors={errors} name="title" />
          </StyledMessage>
        </ContentDiv>
        <ContentDiv>
          <ContentSpan>상세 설명</ContentSpan>
          <ContentTextArea
            maxLength={1000}
            {...register("content", {
              required: "설명을 입력해주세요.",
            })}
          ></ContentTextArea>
          <StyledMessage>
            <ErrorMessage errors={errors} name="content" />
          </StyledMessage>
        </ContentDiv>
        <ContentDiv>
          <ContentSpan>가격</ContentSpan>
          {/* <NumericFormat
            type="text"
            placeholder=", 없이 입력해주세요"
            suffix={" 원"}
            style={{
              fontSize: "1rem",
              paddingLeft: "0.5rem",
            }}
            thousandSeparator=","
            // {...register("price", { required: "가격을 입력해주세요" })}
          /> */}
          <ContentInput
            type="number"
            {...register("price", {
              required: "가격을 입력해주세요",
              pattern: {
                value: /^[1-9]\d*$/,
                message: "잘못된 값입니다.",
              },
            })}
          ></ContentInput>
          <StyledMessage>
            <ErrorMessage errors={errors} name="price" />
          </StyledMessage>
        </ContentDiv>
        <ContentDiv>
          <ContentSpan>카테고리</ContentSpan>
          <div>
            {selectedCategories.map((category: any) => {
              return (
                <Button
                  type="button"
                  kind="extraSmall"
                  Variant="filled"
                  style={{
                    padding: "8px",
                    margin: "0.2rem",
                    width: "8rem",
                    borderRadius: "10px",
                  }}
                  onClick={discardCategory}
                  value={category}
                >
                  {category}
                </Button>
              );
            })}
          </div>
          <CategorySelect
            {...register("category", {
              required: "물품의 종류을 입력해주세요",
              onChange: onChange,
            })}
          >
            <option value="" disabled selected>
              물품의 종류를 선택해주세요
            </option>

            {allCategories?.map((category: any) => {
              return <option>{category}</option>;
            })}
          </CategorySelect>
          <StyledMessage>
            <ErrorMessage errors={errors} name="category" />
          </StyledMessage>
        </ContentDiv>
        <ContentDiv>
          <ContentSpan>사진 업로드</ContentSpan>
          <DragDrop files={files} setFiles={setFiles} />
        </ContentDiv>

        <ButtonDiv>
          <StyledButton type="button" onClick={toggle}>
            일정 선택
          </StyledButton>
          <StyledButton>등록</StyledButton>
        </ButtonDiv>
      </ContainerForm>
    </ContainerAll>
  );
}
const ContainerAll = styled(motion.div)`
  display: flex;
  justify-content: center;
  /* padding: 5rem 0 13rem 0; */
`;

const ContainerForm = styled.form`
  display: flex;
  flex-direction: column;
  width: 35rem;
  padding: 4rem;
  margin: 5rem 0 13rem 0;
  box-shadow: 0 5px 5px 5px rgb(222, 222, 222);
`;

const TitleSpan = styled.span`
  font-size: 2.5rem;
  font-weight: 500;
  margin-bottom: 1rem;
  margin-top: 1rem;
`;

const ContentDiv = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
`;

const ContentSpan = styled.span`
  color: #5a5a5a;
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
  font-size: 1rem;
`;

const ContentInput = styled.input`
  height: 2rem;
  width: 100%;
  padding-left: 0.7rem;
  border-radius: 0.4rem;
  font-size: 1rem;
  border: transparent;
  background-color: #f4f4f4;

  &:focus {
    box-shadow: 0 0 10px #9ec4f2;
    outline: none;
    background-color: white;
  }

  &::-webkit-inner-spin-button {
    appearance: none;
    -moz-appearance: none;
    -webkit-appearance: none;
  }
`;

const StyledMessage = styled.div`
  display: flex;
  justify-content: start;
  padding-left: 0.3;
  margin: 0.3rem;
  color: tomato;
`;

const ContentTextArea = styled.textarea`
  height: 12rem;
  width: 100%;
  border-radius: 0.4rem;
  border: transparent;
  font-size: 1rem;
  padding-left: 0.7rem;
  background-color: #f4f4f4;
  resize: none;
  overflow-y: auto;

  &:focus {
    box-shadow: 0 0 10px #9ec4f2;
    outline: none;
    background-color: white;
  }
`;

const CategorySelect = styled.select`
  height: 2rem;
  width: 100%;
  border-radius: 0.4rem;
  color: #254021;
`;

const ButtonDiv = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 2rem;
`;

const StyledButton = styled.button`
  height: 2.6rem;
  width: 11rem;
  margin-right: 0.8rem;
  border-radius: 0.4rem;
  background-color: #cde990;
  border: #cde990;
  color: #254021;
  font-size: 1rem;

  &:hover {
    border: 2px solid #cde990;
    background-color: white;
    cursor: pointer;
  }
`;

const ModalDiv = styled.div`
  float: right;
`;

const ModalSpan = styled.div`
  font-size: 1.8rem;
  font-weight: 600;
  margin-top: 3rem;
  /* border: solid green; */
`;

const CalendarDiv = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem;
`;

const StyledBtn = styled.button`
  width: 9rem;
  height: 2.5rem;
  background-color: #cde990;
  border: solid 1px #cde990;
  border-radius: 0.4rem;
  cursor: pointer;
  margin-right: 0.4rem;
  margin-top: 1rem;
  font-size: 1rem;

  &:hover {
    background-color: white;
  }
`;

const TimeContainerDiv = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 35rem;
`;

const TimeDiv = styled.div`
  align-items: center;
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  border: solid 1px black;
  padding: 1rem;
  width: 15rem;
`;

const TimeSvg = styled.svg`
  height: 1.3rem;
  width: 1.3rem;
  cursor: pointer;
`;
