import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "~/lib/auth";
import { GREEN, GROUND } from "~/theme/tokens";

/** The fork: straight in when the session survived, to the door when it did not. */
export default function Entry() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: GROUND }}>
        <ActivityIndicator color={GREEN} />
      </View>
    );
  }

  return <Redirect href={user ? "/contas" : "/login"} />;
}
