import { useEffect, useMemo, useRef, useState } from "react";
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
function App() {
  const [CallDocId, setCallDocId] = useState("");
  const [JoinCallId, setJoinCallId] = useState("");
  const RemoteStream = useMemo(() => new MediaStream(), []);
  const RTCConnection = useMemo(() => new RTCPeerConnection(RtcServers), []);
  const LocalVideo = useRef();
  const RemoteVideo = useRef();
  useEffect(() => {
    (async () => {
      try {
        const localMediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
        LocalVideo.current.srcObject = localMediaStream;
        RemoteVideo.current.srcObject = RemoteStream;
        localMediaStream
          .getTracks()
          .forEach((track) => RTCConnection.addTrack(track, localMediaStream));
        RTCConnection.ontrack = (event) => {
          event.streams[0]
            .getTracks()
            .forEach((track) => RemoteStream.addTrack(track));
        };
      } catch (error) {
        console.log({ error });
      }
    })();
  }, []);
  const createCall = async () => {
    try {
      const callDoc = doc(CallDocsCollection);
      onSnapshot(callDoc, async (Snapshot) => {
        try {
          const data = Snapshot.data();
          if (!data.answer) return;
          const { type, sdp } = data.answer;
          const RemoteDescription = new RTCSessionDescription({
            type,
            sdp,
          });
          console.log({ type, sdp });
          if (!RTCConnection.remoteDescription)
            await RTCConnection.setRemoteDescription(RemoteDescription);
        } catch (error) {
          console.log({ snapShotError: error });
        }
      });
      const offer = await RTCConnection.createOffer();
      await setDoc(callDoc, {
        offer: { sdp: offer.sdp, type: offer.type },
      });
      await RTCConnection.setLocalDescription(offer);
      RTCConnection.onicecandidate = async (event) => {
        event.candidate &&
          (await setDoc(callDoc, {
            offer: {
              sdp: RTCConnection.localDescription.sdp,
              type: offer.type,
            },
          }));
      };
      setCallDocId(callDoc.id);
    } catch (error) {
      console.log({ error });
    }
  };
  const JoinCall = async () => {
    if (!JoinCallId) {
      alert("Please Enter A Call Id");
      return;
    }
    try {
      const docRef = doc(CallDocsCollection, JoinCallId);
      const data = (await getDoc(docRef)).data();
      const { type, sdp } = data.offer;
      const RemoteDescription = new RTCSessionDescription({
        type,
        sdp,
      });
      await RTCConnection.setRemoteDescription(RemoteDescription);
      const answer = await RTCConnection.createAnswer();
      await RTCConnection.setLocalDescription(answer);
      RTCConnection.onicecandidate = (event) => {
        event.candidate &&
          setDoc(docRef, {
            ...data,
            answer: {
              sdp: RTCConnection.localDescription.sdp,
              type: answer.type,
            },
          });
      };
    } catch (error) {
      console.log({ error });
    }
  };

  return (
    <main>
      <div className="videoContainer">
        <video ref={LocalVideo} autoPlay playsInline></video>
        <video ref={RemoteVideo} autoPlay playsInline></video>
      </div>
      {CallDocId && <p>{CallDocId}</p>}
      <button onClick={createCall}>create Call</button>
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
