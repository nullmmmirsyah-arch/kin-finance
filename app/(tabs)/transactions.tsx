import { Redirect } from "expo-router";

export default function DeprecatedTransactions() {
  return <Redirect href={"/search" as never} />;
}
