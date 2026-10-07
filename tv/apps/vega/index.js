import 'fast-text-encoding'; // react-native-qrcode-svg uses TextEncoder (Vega doc: qrcode-svg)
import { AppRegistry, LogBox } from 'react-native';
import { App } from './src/App';
import { name as appName } from './app.json';

LogBox.ignoreAllLogs();

AppRegistry.registerComponent(appName, () => App);
