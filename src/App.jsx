import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  collection,
  getDoc,
  doc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import "./App.css";
const RtcServers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};
const CallDocsCollection = collection(db, "calldocs");
async function GetVideoAndAudioStream() {
  const rtcLocalMediaStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
  const LocalVideoOnlyStream = new MediaStream();
  rtcLocalMediaStream
    .getVideoTracks()
    .forEach((track) => LocalVideoOnlyStream.addTrack(track));
  return { LocalVideoOnlyStream, rtcLocalMediaStream };
}
function CreateNewConnection(rtcConnection, RemoteStream) {
  console.log(rtcConnection?.currentRemoteDescription);
  const connection =
    !rtcConnection?.currentRemoteDescription &&
    typeof rtcConnection === "object"
      ? rtcConnection
      : new RTCPeerConnection(RtcServers);
  connection.ontrack &&
    (connection.ontrack = (event) => {
      event.streams[0]
        .getTracks()
        .forEach((track) => RemoteStream.addTrack(track));
    });
  return connection;
}
function reducer(state, { action: { JoinCallId, RemoteStream }, type }) {
  const { CallDocId, RTCConnection, callDoc } = state;
  const connection = CreateNewConnection(RTCConnection, RemoteStream);
  switch (type) {
    case "createCall":
      const callDoc = doc(CallDocsCollection);
      createCall(callDoc, connection);
      return {
        callDoc,
        RTCConnection: connection,
        CallDocId: callDoc.id,
      };
    case "JoinCall":
      JoinCall(JoinCallId, connection);
      return state;
    default:
      break;
  }
  async function JoinCall(JoinCallId, connection) {
    const docRef = doc(CallDocsCollection, JoinCallId);
    const data = (await getDoc(docRef)).data();
    const { type, sdp } = data.offer;
    const RemoteDescription = new RTCSessionDescription({
      type,
      sdp,
    });
    await connection.setRemoteDescription(RemoteDescription);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    console.log({ connection });
    console.log({ RemoteDescription, answer });
    connection.onicecandidate = (event) => {
      event.candidate &&
        setDoc(docRef, {
          ...data,
          answer: {
            sdp: connection.localDescription.sdp,
            type: answer.type,
          },
        });
    };
  }
  async function createCall(callDoc, connection) {
    if (!connection) return;
    const offer = await connection.createOffer();
    await setDoc(callDoc, {
      offer: { sdp: offer.sdp, type: offer.type },
    });
    await connection.setLocalDescription(offer);
    connection.onicecandidate = async (event) => {
      event.candidate &&
        (await setDoc(callDoc, {
          offer: {
            sdp: connection.localDescription.sdp,
            type: offer.type,
          },
        }));
    };
  }
}
function App() {
  const [JoinCallId, setJoinCallId] = useState("");
  const LocalVideo = useRef();
  const RemoteVideo = useRef();

  const [state, dispatch] = useReducer(
    reducer,
    {
      CallDocId: "",
      RTCConnection: new RTCPeerConnection(RtcServers),
      callDoc: null,
    },
    (state) => {
      state.RTCConnection.ontrack = (event) => {
        event.streams[0]
          .getTracks()
          .forEach((track) => RemoteStream.addTrack(track));
      };
      return state;
    }
  );
  const { CallDocId, RTCConnection, callDoc } = state;
  const RemoteStream = useMemo(() => new MediaStream(), [RTCConnection]);
  const UnListen = useMemo(() => {
    if (!callDoc) return () => {};
    return onSnapshot(callDoc, async (Snapshot) => {
      console.log("snappy");
      try {
        const data = Snapshot.data();
        if (!data?.answer) return;
        const { type, sdp } = data.answer;
        const RemoteDescription = new RTCSessionDescription({
          type,
          sdp,
        });
        if (!RTCConnection.remoteDescription)
          await RTCConnection.setRemoteDescription(RemoteDescription);
      } catch (error) {
        console.log({ snapshotError: error });
      }
    });
  }, [callDoc]);
  useEffect(() => {
    (async () => {
      try {
        RemoteVideo.current.srcObject = RemoteStream;
        if (LocalVideo.current.srcObject) {
          console.log({ src: RemoteVideo.current.srcObject });
          return;
        }
        const { LocalVideoOnlyStream, rtcLocalMediaStream } =
          await GetVideoAndAudioStream();
        LocalVideo.current.srcObject = LocalVideoOnlyStream;
        rtcLocalMediaStream
          .getTracks()
          .forEach((track) =>
            RTCConnection.addTrack(track, rtcLocalMediaStream)
          );
      } catch (error) {
        console.log({ error });
      }
    })();
    return () => {
      UnListen();
      RemoteVideo.current.srcObject = null;
    };
  }, [RTCConnection]);
  const createCall = () => {
    dispatch({
      type: "createCall",
      action: {
        RemoteStream,
      },
    });
  };
  const JoinCall = () => {
    if (!JoinCallId) {
      alert("Please Enter A Call Id");
      return;
    }
    dispatch({
      type: "JoinCall",
      action: {
        JoinCallId,
        RemoteStream,
      },
    });
  };

  return (
    <main>
      <div className="videoContainer">
        <video ref={LocalVideo} autoPlay playsInline></video>
        <video ref={RemoteVideo} autoPlay playsInline></video>
      </div>
      {CallDocId && <p>{CallDocId}</p>}
      <button onClick={createCall}>create a new Call</button>
      <input
        type="text"
        value={JoinCallId}
        onChange={(e) => setJoinCallId(e.target.value)}
        placeholder="Enter Call Id"
      />
      <button onClick={JoinCall}>Join Call</button>
    </main>
  );
}

export default App;
