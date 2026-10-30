import { Redirect } from "expo-router";

/* Willo lives in one place: the conversation screen. */
export default function Assistente() {
  return <Redirect href={"/registro" as never} />;
}
