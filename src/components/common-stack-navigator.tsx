import CommonAdvancedNavigator from "./common-advanced-navigator"

function CommonStackNavigator({ Screen, screenName }: { Screen(): React.JSX.Element, screenName: string }) {
    return <CommonAdvancedNavigator screens={[
        {
            name: screenName,
            component: Screen,
        }
    ]} />
}

export default CommonStackNavigator