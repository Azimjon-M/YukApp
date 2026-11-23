// Ilova ochilayotganda, bloklanganda yoki server bilan aloqa bo'lmaganda ko'rinadigan ekran
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BLOCKED_TEXT } from "@yuk/shared";
import { useSession } from "../session.js";
import { colors, space } from "../theme.js";
import { Button, Notice, Spinner } from "../ui.js";

export default function StatusScreen() {
  const { status, error, connect, leave } = useSession();
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.center}>
        {status === "blocked" ? (
          <Notice title={`⛔ ${error || BLOCKED_TEXT}`} />
        ) : status === "offline" ? (
          <Notice
            title="📡 Server bilan aloqa yo'q"
            action={
              <>
                <Button title="Qayta urinish" onPress={connect} />
                <Button title="Boshqa hisob bilan kirish" kind="link" onPress={leave} />
              </>
            }
          >
            {error || "Internetni tekshiring va qayta urinib ko'ring."}
          </Notice>
        ) : (
          <Spinner label="Ochilyapti..." />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: "center", padding: space.lg },
});
