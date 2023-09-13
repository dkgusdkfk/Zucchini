import axios from "axios";
import { OpenVidu } from "openvidu-browser";
import React, { Component } from "react";
import StreamComponent from "../stream/StreamComponent.js";
import "./ConferenceRoom.css";

import OpenViduLayout from "../../layout/openvidu-layout.js";
import UserModel from "../../models/user-model.js";
import ToolbarComponent from "../toolbar/ToolbarComponent.js";
import TopbarComponent from "../toolbar/TopbarComponent";
import LiveChat from "../Chat/LiveChat.js";
import { getUser } from "../../hooks/useLocalStorage";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import api from "../../utils/api";
import { EventSourcePolyfill } from "event-source-polyfill";
import { getUserInfo } from "../../hooks/useUserInfo";
import { BASE_URL } from "../../constants/url";
import Modal from "../Common/Modal";
import ClosedButton from "../Button/ClosedButton";
import styled from "styled-components";

var localUser = new UserModel();
const APPLICATION_SERVER_URL = BASE_URL;

class ConferenceRoom extends Component {
  constructor(props) {
    super(props);
    this.conferenceNo = window.location.pathname.split("/conference/")[1];
    this.title = props.title;
    this.itemNo = null;
    this.buyer = "";
    this.hasBeenUpdated = false;
    this.layout = new OpenViduLayout();
    let sessionName = this.conferenceNo;
    let userName = JSON.parse(localStorage.getItem("USER_INFO")).nickname;
    this.remotes = [];
    this.localUserAccessAllowed = false;
    this.state = {
      sessionToken: undefined,
      mySessionId: sessionName,
      myUserName: userName,
      session: undefined,
      localUser: undefined,
      subscribers: [],
      chatDisplay: "none",
      currentVideoDevice: undefined,
      isOkModalOpen: false,
      isNotOkModalOpen: false,
      isBuyModalOpen: false,
    };

    this.joinSession = this.joinSession.bind(this);
    this.leaveSession = this.leaveSession.bind(this);
    this.dealItem = this.dealItem.bind(this);
    this.onbeforeunload = this.onbeforeunload.bind(this);
    this.updateLayout = this.updateLayout.bind(this);
    this.camStatusChanged = this.camStatusChanged.bind(this);
    this.micStatusChanged = this.micStatusChanged.bind(this);
    this.toggleFullscreen = this.toggleFullscreen.bind(this);
    this.switchCamera = this.switchCamera.bind(this);
    this.closeDialogExtension = this.closeDialogExtension.bind(this);
    this.toggleChat = this.toggleChat.bind(this);
    this.checkNotification = this.checkNotification.bind(this);
    this.checkSize = this.checkSize.bind(this);
    this.getInformation = this.getInformation.bind(this);
    this.buyItem = this.buyItem.bind(this);
    this.dontbuyItem = this.dontbuyItem.bind(this);
    this.close = this.close.bind(this);
    this.stopRecording = this.stopRecording.bind(this);
    this.toggleNotOkModal = this.toggleNotOkModal.bind(this);
  }

  async componentDidMount() {
    const information = await this.getInformation();
    this.itemNo = information.itemNo;
    this.buyer = information.username;
    const conferNo = window.location.pathname.split("/conference/")[1];

    const headers = { Authorization: `Bearer ${getUser()}` };
    const sse = new EventSourcePolyfill(BASE_URL + `sse/${conferNo}`, {
      headers: headers,
    });

    const userinfo = localStorage.getItem("USER_INFO");
    const parsedinfo = JSON.parse(userinfo);

    sse.addEventListener("connect", (e) => {
      const { data: receivedConnectData } = e;
    });

    sse.addEventListener("buy", async (e) => {
      // count를 누른 유저가 아닌데 count event를 인식했으면 alert를 띄움
      const { data: receivedCount } = e;
      if (this.buyer !== parsedinfo.nickname) {
        await this.dealItem();
        await this.stopRecording();
      }
      setTimeout(
        () => this.setState({ isOkModalOpen: !this.state.isOkModalOpen }),
        3000
      );
    });

    sse.addEventListener("notbuy", (e) => {
      // count를 누른 유저가 아닌데 count event를 인식했으면 alert를 띄움
      const { data: receivedCount } = e;
      if (receivedCount !== parsedinfo.nickname) {
        this.setState({ isNotOkModalOpen: !this.state.isNotOkModalOpen });
      }
    });

    sse.addEventListener("requestDeal", (e) => {
      // count를 누른 유저가 아닌데 count event를 인식했으면 alert를 띄움
      const { data: receivedCount } = e;
      if (receivedCount !== parsedinfo.nickname) {
        this.setState({ isBuyModalOpen: !this.state.isBuyModalOpen });
      }
    });

    const openViduLayoutOptions = {
      maxRatio: 3 / 2, // The narrowest ratio that will be used (default 2x3)
      minRatio: 9 / 16, // The widest ratio that will be used (default 16x9)
      fixedRatio: false, // If this is true then the aspect ratio of the video is maintained and minRatio and maxRatio are ignored (default false)
      bigClass: "OV_big", // The class to add to elements that should be sized bigger
      bigPercentage: 0.8, // The maximum percentage of space the big ones should take up
      bigFixedRatio: false, // fixedRatio for the big ones
      bigMaxRatio: 3 / 2, // The narrowest ratio to use for the big elements (default 2x3)
      bigMinRatio: 9 / 16, // The widest ratio to use for the big elements (default 16x9)
      bigFirst: true, // Whether to place the big one in the top left (true) or bottom right
      animate: true, // Whether you want to animate the transitions
    };

    this.layout.initLayoutContainer(
      document.getElementById("layout"),
      openViduLayoutOptions
    );
    window.addEventListener("beforeunload", this.onbeforeunload);
    window.addEventListener("resize", this.updateLayout);
    window.addEventListener("resize", this.checkSize);
    this.joinSession();
  }

  // 컴포넌트 페이지에서 빠져나오게 되면 이 함수가 실행됨
  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.onbeforeunload);
    window.removeEventListener("resize", this.updateLayout);
    window.removeEventListener("resize", this.checkSize);
    this.leaveSession();
  }

  onbeforeunload(event) {
    this.leaveSession();
  }

  joinSession() {
    this.OV = new OpenVidu();

    this.setState(
      {
        session: this.OV.initSession(),
      },
      async () => {
        this.subscribeToStreamCreated();
        await this.connectToSession();
      }
    );
  }

  async connectToSession() {
    if (this.props.token !== undefined) {
      console.log("token received: ", this.props.token);
      this.connect(this.props.token);
    } else {
      try {
        var token = await this.getToken();
        console.log(token);
        this.sessionToken = token;
        console.log("세션 토큰---->", this.sessionToken);
        this.sessionToken = token;
        console.log("세션 토큰---->", this.sessionToken);
        this.connect(token);
      } catch (error) {
        console.error(
          "There was an error getting the token:",
          error.code,
          error.message
        );
        if (this.props.error) {
          this.props.error({
            error: error.error,
            message: error.message,
            code: error.code,
            status: error.status,
          });
        }
        alert("There was an error getting the token:", error.message);
      }
    }
  }

  connect(token) {
    this.state.session
      .connect(token, { clientData: this.state.myUserName })
      .then(() => {
        this.connectWebCam();
      })
      .catch((error) => {
        if (this.props.error) {
          this.props.error({
            error: error.error,
            message: error.message,
            code: error.code,
            status: error.status,
          });
        }
        alert("There was an error connecting to the session:", error.message);
        console.log(
          "There was an error connecting to the session:",
          error.code,
          error.message
        );
      });
  }

  async connectWebCam() {
    await this.OV.getUserMedia({
      audioSource: undefined,
      videoSource: undefined,
    });
    var devices = await this.OV.getDevices();
    var videoDevices = devices.filter((device) => device.kind === "videoinput");

    let publisher = this.OV.initPublisher(undefined, {
      audioSource: undefined,
      videoSource: videoDevices[0].deviceId,
      publishAudio: localUser.isAudioActive(),
      publishVideo: localUser.isVideoActive(),
      resolution: "640x480",
      frameRate: 30,
      insertMode: "APPEND",
    });

    if (this.state.session.capabilities.publish) {
      publisher.on("accessAllowed", () => {
        this.state.session.publish(publisher).then(() => {
          this.updateSubscribers();
          this.localUserAccessAllowed = true;
          if (this.props.joinSession) {
            this.props.joinSession();
          }
        });
      });
    }
    localUser.setNickname(this.state.myUserName);
    localUser.setConnectionId(this.state.session.connection.connectionId);
    localUser.setScreenShareActive(false);
    localUser.setStreamManager(publisher);
    this.subscribeToUserChanged();
    this.subscribeToStreamDestroyed();
    this.sendSignalUserChanged({
      isScreenShareActive: localUser.isScreenShareActive(),
    });

    this.setState(
      { currentVideoDevice: videoDevices[0], localUser: localUser },
      () => {
        this.state.localUser.getStreamManager().on("streamPlaying", (e) => {
          this.updateLayout();
          publisher.videos[0].video.parentElement.classList.remove(
            "custom-class"
          );
        });
      }
    );
  }

  updateSubscribers() {
    var subscribers = this.remotes;
    this.setState(
      {
        subscribers: subscribers,
      },
      () => {
        if (this.state.localUser) {
          this.sendSignalUserChanged({
            isAudioActive: this.state.localUser.isAudioActive(),
            isVideoActive: this.state.localUser.isVideoActive(),
            nickname: this.state.localUser.getNickname(),
            isScreenShareActive: this.state.localUser.isScreenShareActive(),
          });
        }
        this.updateLayout();
      }
    );
  }

  async leaveSession() {
    // 여기에 api 호출~~
    console.log("세션을 떠나요");
    const token = "Bearer " + getUser();
    await axios.put(
      APPLICATION_SERVER_URL + `session`,
      {
        conferenceNo: this.conferenceNo,
        token: this.sessionToken,
      },
      {
        headers: { Authorization: token },
      }
    );

    const mySession = this.state.session;

    if (mySession) {
      mySession.disconnect();
    }

    // Empty all properties...
    this.OV = null;
    this.setState({
      session: undefined,
      subscribers: [],
      mySessionId: 0,
      myUserName: "알수없음",
      localUser: undefined,
    });
  }

  async dealItem() {
    //아이템 상태 예약중으로 변경하기
    const buyer = this.buyer;
    await api.put(`item/${this.itemNo}/deal?buyer=${buyer}`);

    // this.leaveSession();
  }

  // info(itemNo, link, startTime, endTime)
  async storeVideo(info) {
    await fetch(info.link)
      .then((response) => response.blob())
      .then(async (blob) => {
        console.log(info);
        const file = new Blob([blob]);

        const credentials = {
          accessKeyId: "",
          secretAccessKey: "",
        };
        const client = new S3Client({
          region: "ap-northeast-2",
          credentials: credentials,
        });
        const uploadFile = async (file) => {
          // const uuid = v1().toString().replace("-", "");
          // const keyName = `${uuid}.${file.object.name}`;
          const keyName = "video/" + info.itemNo + ".mp4"; // S3에 저장될 경로와 파일 이름
          console.log("keyName------>", keyName);
          const command = new PutObjectCommand({
            Bucket: "zucchinifile",
            Key: keyName,
            Body: file,
          });
          try {
            console.log("aws접속시작-------->");
            await client.send(command);
            // 비디오의 공개 URL 생성
            console.log("aws접속종료-------->");
            const videoURL = `https://zucchinifile.s3.ap-northeast-2.amazonaws.com/${keyName}`;
            console.log("videoUrl-------->", videoURL);
            // 여기에 api 호출~~
            const token = "Bearer " + getUser();
            const response = await axios.post(
              APPLICATION_SERVER_URL + `video`,
              {
                link: videoURL,
                itemNo: info.itemNo,
                startTime: info.startTime,
                endTime: info.endTime,
              },
              {
                headers: { Authorization: token },
              }
            );
            console.log("비디오 저장 완료");
          } catch (err) {
            console.error(err);
          }
        };
        await uploadFile(file);
      });
  }

  camStatusChanged() {
    localUser.setVideoActive(!localUser.isVideoActive());
    localUser.getStreamManager().publishVideo(localUser.isVideoActive());
    this.sendSignalUserChanged({ isVideoActive: localUser.isVideoActive() });
    this.setState({ localUser: localUser });
  }

  micStatusChanged() {
    localUser.setAudioActive(!localUser.isAudioActive());
    localUser.getStreamManager().publishAudio(localUser.isAudioActive());
    this.sendSignalUserChanged({ isAudioActive: localUser.isAudioActive() });
    this.setState({ localUser: localUser });
  }

  deleteSubscriber(stream) {
    const remoteUsers = this.state.subscribers;
    const userStream = remoteUsers.filter(
      (user) => user.getStreamManager().stream === stream
    )[0];
    let index = remoteUsers.indexOf(userStream, 0);
    if (index > -1) {
      remoteUsers.splice(index, 1);
      this.setState({
        subscribers: remoteUsers,
      });
    }
  }

  subscribeToStreamCreated() {
    this.state.session.on("streamCreated", (event) => {
      const subscriber = this.state.session.subscribe(event.stream, undefined);
      subscriber.on("streamPlaying", (e) => {
        subscriber.videos[0].video.parentElement.classList.remove(
          "custom-class"
        );
      });
      const newUser = new UserModel();
      newUser.setStreamManager(subscriber);
      newUser.setConnectionId(event.stream.connection.connectionId);
      newUser.setType("remote");
      const nickname = event.stream.connection.data.split("%")[0];
      newUser.setNickname(JSON.parse(nickname).clientData);
      this.remotes.push(newUser);
      if (this.localUserAccessAllowed) {
        this.updateSubscribers();
      }
    });
  }

  subscribeToStreamDestroyed() {
    // On every Stream destroyed...
    this.state.session.on("streamDestroyed", (event) => {
      // Remove the stream from 'subscribers' array
      this.deleteSubscriber(event.stream);
      event.preventDefault();
      this.updateLayout();
    });
  }

  subscribeToUserChanged() {
    this.state.session.on("signal:userChanged", (event) => {
      let remoteUsers = this.state.subscribers;
      remoteUsers.forEach((user) => {
        if (user.getConnectionId() === event.from.connectionId) {
          const data = JSON.parse(event.data);
          console.log("EVENTO REMOTE: ", event.data);
          if (data.isAudioActive !== undefined) {
            user.setAudioActive(data.isAudioActive);
          }
          if (data.isVideoActive !== undefined) {
            user.setVideoActive(data.isVideoActive);
          }
          if (data.nickname !== undefined) {
            user.setNickname(data.nickname);
          }
          if (data.isScreenShareActive !== undefined) {
            user.setScreenShareActive(data.isScreenShareActive);
          }
        }
      });
      this.setState({
        subscribers: remoteUsers,
      });
    });
  }

  updateLayout() {
    setTimeout(() => {
      this.layout.updateLayout();
    }, 20);
  }

  sendSignalUserChanged(data) {
    const signalOptions = {
      data: JSON.stringify(data),
      type: "userChanged",
    };
    this.state.session.signal(signalOptions);
  }

  toggleFullscreen() {
    const document = window.document;
    const fs = document.getElementById("container");
    if (
      !document.fullscreenElement &&
      !document.mozFullScreenElement &&
      !document.webkitFullscreenElement &&
      !document.msFullscreenElement
    ) {
      if (fs.requestFullscreen) {
        fs.requestFullscreen();
      } else if (fs.msRequestFullscreen) {
        fs.msRequestFullscreen();
      } else if (fs.mozRequestFullScreen) {
        fs.mozRequestFullScreen();
      } else if (fs.webkitRequestFullscreen) {
        fs.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  async switchCamera() {
    try {
      const devices = await this.OV.getDevices();
      var videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      if (videoDevices && videoDevices.length > 1) {
        var newVideoDevice = videoDevices.filter(
          (device) => device.deviceId !== this.state.currentVideoDevice.deviceId
        );

        if (newVideoDevice.length > 0) {
          // Creating a new publisher with specific videoSource
          // In mobile devices the default and first camera is the front one
          var newPublisher = this.OV.initPublisher(undefined, {
            audioSource: undefined,
            videoSource: newVideoDevice[0].deviceId,
            publishAudio: localUser.isAudioActive(),
            publishVideo: localUser.isVideoActive(),
            mirror: true,
          });

          //newPublisher.once("accessAllowed", () => {
          await this.state.session.unpublish(
            this.state.localUser.getStreamManager()
          );
          await this.state.session.publish(newPublisher);
          this.state.localUser.setStreamManager(newPublisher);
          this.setState({
            currentVideoDevice: newVideoDevice,
            localUser: localUser,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  closeDialogExtension() {
    this.setState({ showExtensionDialog: false });
  }

  toggleChat(property) {
    let display = property;

    if (display === undefined) {
      display = this.state.chatDisplay === "none" ? "block" : "none";
    }
    if (display === "block") {
      this.setState({ chatDisplay: display, messageReceived: false });
    } else {
      console.log("chat", display);
      this.setState({ chatDisplay: display });
    }
    this.updateLayout();
  }

  checkNotification(event) {
    this.setState({
      messageReceived: this.state.chatDisplay === "none",
    });
  }
  checkSize() {
    if (
      document.getElementById("layout").offsetWidth <= 700 &&
      !this.hasBeenUpdated
    ) {
      this.toggleChat("none");
      this.hasBeenUpdated = true;
    }
    if (
      document.getElementById("layout").offsetWidth > 700 &&
      this.hasBeenUpdated
    ) {
      this.hasBeenUpdated = false;
    }
  }

  async getInformation() {
    //먼저 해당 컨퍼런스 번호에 대한 아이템 번호 가져오기
    const response = await api.get(`conference/${this.conferenceNo}/itemNo`);
    return response.data;
  }

  async buyItem() {
    // 거래 확정되었다는 안내문구 팝업시키기

    const conferNo = window.location.pathname.split("/conference/")[1];
    const userinfo = localStorage.getItem("USER_INFO");
    if (userinfo === null) return;
    const parsedinfo = JSON.parse(userinfo);
    const response = await api.post(`/sse/count/${conferNo}`, {
      userName: parsedinfo.nickname,
      buy: true,
    });

    this.setState({ isBuyModalOpen: !this.state.isBuyModalOpen });
  }

  async dontbuyItem() {
    const conferNo = window.location.pathname.split("/conference/")[1];
    const userinfo = localStorage.getItem("USER_INFO");
    if (userinfo === null) return;
    const parsedinfo = JSON.parse(userinfo);
    const response = await api.post(`/sse/count/${conferNo}`, {
      userName: parsedinfo.nickname,
      buy: false,
    });

    this.setState({ isBuyModalOpen: !this.state.isBuyModalOpen });
  }

  async close() {
    window.location.href = `/scheduleList`;
  }

  async stopRecording() {
    const response = await api.get(`session/record/${this.conferenceNo}`);
    console.log(
      "response------------------------------------------------->" + response
    );
    await this.storeVideo(response.data);
  }

  toggleNotOkModal() {
    this.setState({ isNotOkModalOpen: !this.state.isNotOkModalOpen });
  }

  render() {
    const localUser = this.state.localUser;
    var chatDisplay = { display: this.state.chatDisplay };

    return (
      <div className="container" id="container">
        <TopbarComponent
          title={this.title}
          other={this.state.subscribers[0]?.nickname}
          itemNo={this.itemNo}
          showNotification={this.state.messageReceived}
          leaveSession={this.leaveSession}
          buyItem={this.buyItem}
          toggleChat={this.toggleChat}
        />

        <div
          id="layout"
          className="bounds"
          style={{ display: "flex", flexDirection: "column" }}
        >
          <div id="videoContainer">
            <div id="middleContainer">
              {localUser !== undefined &&
              localUser.getStreamManager() !== undefined ? (
                <div
                  className="OT_root OT_publisher custom-class"
                  id="localUser"
                  style={{ height: "30rem" }}
                >
                  <StreamComponent
                    user={localUser}
                    handleNickname={this.nicknameChanged}
                  />
                </div>
              ) : (
                <div
                  className="OT_root OT_publisher custom-class"
                  style={{
                    backgroundColor: "lightGray",
                    height: "30rem",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "1.3rem",
                  }}
                >
                  <p>아직 입장하지 않았습니다..</p>
                </div>
              )}
              {this.state.subscribers.length < 1 ? (
                <div
                  className="OT_root OT_publisher custom-class"
                  style={{
                    backgroundColor: "lightGray",
                    height: "30rem",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "1.3rem",
                  }}
                >
                  <p>아직 입장하지 않았습니다..</p>
                </div>
              ) : (
                this.state.subscribers.map((sub, i) => (
                  <div
                    key={i}
                    className="OT_root OT_publisher custom-class"
                    id="remoteUsers"
                    style={{ height: "30rem" }}
                  >
                    <StreamComponent
                      user={sub}
                      streamId={sub.streamManager.stream.streamId}
                    />
                  </div>
                ))
              )}
            </div>
            <div class="buttonContainer">
              {/* <button class="redButton">종료하기</button> */}
              <ToolbarComponent
                user={localUser}
                camStatusChanged={this.camStatusChanged}
                micStatusChanged={this.micStatusChanged}
                toggleFullscreen={this.toggleFullscreen}
                switchCamera={this.switchCamera}
              />
              {/* <button class="greenButton">구매하기</button> */}
            </div>
          </div>
          {localUser !== undefined &&
            localUser.getStreamManager() !== undefined && (
              <div
                className="OT_root OT_publisher custom-class"
                style={chatDisplay}
                id="liveChatContainer"
              >
                <LiveChat
                  user={localUser}
                  chatDisplay={this.state.chatDisplay}
                  close={this.toggleChat}
                  messageReceived={this.checkNotification}
                />
              </div>
            )}
        </div>
        <Modal isOpen={this.state.isBuyModalOpen} toggle={this.dontbuyItem}>
          <div className="modalDiv" onClick={this.dontbuyItem}>
            <ClosedButton />
          </div>
          <div className="modalSpan">거래 확정하기</div>
          <div className="pDiv">
            <p>
              {this.state.subscribers[0]?.nickname}님께서 거래 희망 버튼을
              눌렀습니다.
            </p>
            <p>
              {this.state.subscribers[0]?.nickname}님과 거래를 확정
              하시겠습니까?
            </p>
          </div>
          <div className="buttonsDiv">
            <button className="greenBtn" onClick={this.buyItem}>
              확정
            </button>
            <button className="redBtn" onClick={this.dontbuyItem}>
              거절
            </button>
          </div>
        </Modal>
        <Modal isOpen={this.state.isOkModalOpen}>
          {/* <ModalDiv>
            <ClosedButton onClick={this.toggleOkModal} />
          </ModalDiv> */}
          <ModalSpan style={{ marginBottom: "1rem" }}>거래 확정!</ModalSpan>
          <div className="pDiv">
            <p>거래 확정이 완료되었습니다.</p>
            <p>화상 통화 리스트로 이동합니다.</p>
          </div>
          <div className="buttonsDiv">
            <button className="greenBtn" onClick={this.close}>
              확인
            </button>
          </div>
        </Modal>
        <Modal isOpen={this.state.isNotOkModalOpen}>
          <ModalDiv>
            <ClosedButton onClick={this.toggleNotOkModal} />
          </ModalDiv>
          <ModalSpan style={{ marginBottom: "1rem" }}>거래 거절</ModalSpan>
          <div className="pDiv">
            <p>
              {this.state.subscribers[0]?.nickname}님이 거래 거절 하였습니다.
            </p>
          </div>
          <div className="buttonsDiv">
            <button className="greenBtn" onClick={this.toggleNotOkModal}>
              확인
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  async getToken() {
    return await this.createToken(this.conferenceNo);
  }

  async createToken(conferenceNo) {
    const token = "Bearer " + getUser();
    const response = await axios.get(
      APPLICATION_SERVER_URL + `session/${conferenceNo}`,
      {
        headers: { Authorization: token },
      }
    );
    console.log(response);
    localStorage.setItem("sessionId", response.data.sessionId);
    return response.data.token; // The token
  }
}
export default ConferenceRoom;

const ModalDiv = styled.div`
  float: right;
`;

const ModalSpan = styled.div`
  font-size: 1.8rem;
  font-weight: 600;
  margin-top: 3rem;
  margin-bottom: 0.5rem;
  color: black;
`;
