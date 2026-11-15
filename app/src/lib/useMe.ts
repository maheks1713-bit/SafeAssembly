import { useMemo } from "react";
import { useTable } from "./store";
import { useCallsign } from "./session";

/** This phone's volunteer row and their assignments (newest first). */
export function useMe() {
  const callsign = useCallsign();
  const volunteers = useTable("volunteers");
  const assignments = useTable("assignments");
  const me = volunteers.find((v) => v.callsign === callsign);
  const mine = useMemo(() => (me ? assignments.filter((a) => a.volunteer_id === me.id) : []), [assignments, me]);
  return { callsign, me, mine, volunteers };
}
