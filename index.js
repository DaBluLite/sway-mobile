import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';
import { install } from 'react-native-quick-crypto';
import TrackPlayer from 'react-native-track-player';
import playbackService from '@dablulite/rn-audio-stream/playbackService';

TrackPlayer.registerPlaybackService(() => playbackService);

install();

AppRegistry.registerComponent(appName, () => App);
