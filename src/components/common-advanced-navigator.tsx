import { createNativeStackNavigator } from "@react-navigation/native-stack"
import AlbumScreen from "../screens/album"
import AlbumListScreen from "../screens/album-list"
import ArtistScreen from "../screens/artist"
import { SubsonicAlbum, SubsonicArtist, SubsonicPlaylist } from "../types/subsonic"
import { Station } from "radio-browser-api"
import StationListScreen from "../screens/station-list"
import PlaylistScreen from "../screens/playlist"
import CurationScreen from "../screens/curation"
import { CuratedCollection } from "../contexts/curations-context"
import LoginScreen from "../screens/login"

interface RootStackParamList {
  [key: string]: any
  AlbumList: { pageTitle: string, albums: SubsonicAlbum[] }
  Album: { pageTitle: string, album: SubsonicAlbum }
  ArtistDetail: { pageTitle: string, artist: SubsonicArtist }
  StationList: { pageTitle: string, stations: Station[] }
  Playlist: { pageTitle: string, playlist: SubsonicPlaylist }
  Curation: { pageTitle: string, curation: CuratedCollection }
}

type ScreenComponentType =
  | React.ComponentType<{
      route: any;
      navigation: any;
    }>
  | React.ComponentType<{}>;

function CommonAdvancedNavigator({ screens }: { screens: { name: string, component: ScreenComponentType, initialParams?: any }[] }) {
  const Stack = createNativeStackNavigator<RootStackParamList>()
  return (<Stack.Navigator screenOptions={{ headerShown: false }}>
    {screens.map((screen) => (
      <Stack.Screen
        key={screen.name}
        name={screen.name}
        component={screen.component}
        initialParams={screen.initialParams}
      />
    ))}
    <Stack.Screen
      name="AlbumList"
      component={AlbumListScreen}
      initialParams={{
        pageTitle: "",
        albums: [] as SubsonicAlbum[]
      }}
    />
    <Stack.Screen
      name="StationList"
      component={StationListScreen}
      initialParams={{
        pageTitle: "",
        stations: [] as Station[]
      }}
    />
    <Stack.Screen
      name="Album"
      component={AlbumScreen}
      initialParams={{
        pageTitle: "",
        album: {} as SubsonicAlbum
      }}
    />
    <Stack.Screen
      name="ArtistDetail"
      component={ArtistScreen}
      initialParams={{
        pageTitle: "",
        artist: {} as SubsonicArtist
      }}
    />
    <Stack.Screen
      name="Playlist"
      component={PlaylistScreen}
      initialParams={{
        pageTitle: "",
        playlist: {} as SubsonicPlaylist
      }}
    />
    <Stack.Screen
      name="Curation"
      component={CurationScreen}
      initialParams={{
        pageTitle: "",
        curation: {} as CuratedCollection
      }}
    />
    <Stack.Screen
      name="Login"
      component={LoginScreen}
    />
  </Stack.Navigator>
  )
}

export default CommonAdvancedNavigator
