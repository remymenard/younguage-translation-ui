import Vue from 'vue/dist/vue.esm.browser';
const jsQR = require('jsqr');
const Peer = require('simple-peer');
const io = require('socket.io-client');
import 'vue-loaders/dist/vue-loaders.css';
import VueLoaders from 'vue-loaders';

const firebaseConfig = {
  apiKey: "AIzaSyC0qt1LiXGTNjJWHsHmJDg1dFTUMOv3Q9A",
  authDomain: "younguage.firebaseapp.com",
  databaseURL: "https://younguage.firebaseio.com",
  projectId: "younguage",
  storageBucket: "younguage.appspot.com",
  messagingSenderId: "641798059657",
  appId: "1:641798059657:web:0a32988332d723745f7858",
  measurementId: "G-RSDE59F0TT"
};

firebase.initializeApp(firebaseConfig)
const defaultAnalytics = firebase.analytics();

const db = firebase.firestore();

const words = db.collection('translations')

const state = {
  selectedWordIndex: null,
  selectedWord: '',
  wordTranslation: '',
  subtitles: [],
  translationActive: false,
  isConnected: false,
  isCamera: false,
  peerId: '',
  error: {
    show: false,
    message: ''
  },
  qr: {
    output: false,
    data: false
  },
  stream: false,
  video: false,
  log: [],
  socket: false,
  peer: false,
  peerConnected: false,
  searchText: '',
  controls: [{
      action: 'play_video',
      icon: 'play_arrow'
    },
    {
      action: 'pause_video',
      icon: 'pause'
    },
    {
      action: 'replay_video',
      icon: 'replay_10'
    },
    {
      action: 'forward_video',
      icon: 'forward_10'
    },
    {
      action: 'next_episode',
      icon: 'fast_forward'
    }
  ]
};

Vue.use(VueLoaders);

const app = new Vue({
  el: '#app',
  data() {
    return state;
  },
  mounted() {
    const peer = new Peer({
      initiator: false,
      trickle: false
    });
    defaultAnalytics.setCurrentScreen ( { screenName :  'enter_id_page' } )
    const socket = io('https://app-b0a2c701-bbde-44b6-8def-81d160ec13f9.cleverapps.io/');
    this.socket = socket;
    this.peer = peer;
    socket.on('incoming-signal', (data) => {
      peer.signal(data);
    });
    peer.on('signal', (data) => {
      socket.emit('set-answer', {
        signal: data,
        id: this.peerId
      });
    });
    peer.on('connect', () => {
      this.peerConnected = true;
    });
    peer.on('data', (data) => {
      this.handleIncoming(data.toString());
    });
    peer.on('error', (e) => {
      this.peerConnected = false;
      this.showError(e.message);
    });
    peer.on('data', (data) => {
      const dataString = data.toString();
      if (dataString[0] === '{') {
        const data = JSON.parse(dataString);
        if (data.action === "subtitles") {
          this.updateSubtitles(data.payload)
        }
      }
    })
    peer.on('close', function (err) {
      this.peerConnected = false;
    });
  },
  methods: {
    closeModal() {
      this.translationActive = false;
      this.selectedWordIndex = null;
    },
    shouldJump(element) {
      return element === 'jump';
    },
    isSelected(index) {
      return this.selectedWordIndex === index;
    },
    addWord() {
      const word = this.selectedWord;
      words.doc(word).set({
        input: word
      }, {
        merge: true
      })
      words.doc(word)
        .onSnapshot((doc) => {
          if (doc.data()) {
            if (doc.data()["translated"]) {
              this.wordTranslation = doc.data()["translated"]["en"]
            }
          }
      });
    },
    updateSubtitles(data) {
      this.closeModal();
      this.subtitles = [];
      data.forEach(element => {
        element.split(" ").forEach((word) => {
          this.subtitles.push(`<div class="mr1">${word}</div>`)
        })
        this.subtitles.push(`jump`)
      });
    },
    openTranslation(word, index) {
      this.selectedWordIndex = index;
      this.highlight = "red";
      this.queries = [word];
      this.selectedWord = word.replace(/<[^>]+>/g, '');
      this.wordTranslation = "";
      this.translationActive = true;
      this.addWord();
      this.videoAction('pause_video')
    },
    sendPeer(data) {
      this.peer.send(JSON.stringify(data));
    },
    showError(message) {
      this.error.show = true;
      this.error.message = message;
    },
    scanCode() {
      const video = this.$refs.video;
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: 'environment'
          }
        })
        .then((stream) => {
          this.stream = stream;
          this.isCamera = true;
          video.srcObject = stream;
          video.setAttribute('playsinline', true);
          video.play();
          requestAnimationFrame(tick);
        })
        .catch((e) => {
          this.showError(e.message);
        });
    },
    connectRemote() {
      const regex = new RegExp("([a-zA-Z0-9]*-){4}[a-zA-Z0-9]*");
      if(regex.test(this.peerId)) {
        this.socket.emit('get-signal', this.peerId);
        defaultAnalytics.logEvent ({ eventName:  "connect_remote" } )
        defaultAnalytics.setCurrentScreen ( { screenName :  'remote_page' } )
        this.error.show = false
      } else {
        this.error.show = true;
        this.error.message = "Please enter a correct stream id";
      }
    },
    searchNetflix() {
      this.sendPeer({
        action: 'search',
        payload: {
          text: this.searchText
        }
      });
    },
    videoAction(action) {
      this.sendPeer({
        action: 'video_action',
        payload: {
          action
        }
      });
    },
    handleIncoming(dataString) {
      const data = JSON.parse(dataString);
      if (Object.keys(data).includes('error')) {
        if (data.error !== 'Already paused') this.showError(data.error);
      }
      if (Object.keys(data).includes('success')) {
        this.error.show = false;
      }
    },
    refreshWindow() {
      window.location.reload();
    }
  }
});

function tick() {
  try {
    const video = app.$refs.video;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvasElement = app.$refs.canvas;
      const canvas = canvasElement.getContext('2d');
      canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });
      if (code) {
        app.stream.getTracks().forEach((track) => track.stop());
        app.isCamera = false;
        app.qr.output = true;
        app.qr.data = code.data;
        app.peerId = code.data;
      } else {
        app.qr.output = false;
        app.qr.data = '';
      }
    }
    if (!app.qr.output) {
      requestAnimationFrame(tick);
    }
  } catch (e) {
    app.error.show = true;
    app.error.message = e.message;
  }
}
