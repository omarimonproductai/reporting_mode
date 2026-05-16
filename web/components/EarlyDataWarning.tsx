"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const CUTOFF_HOUR = 10;

function isBeforeCutoffInCatalunya(): boolean {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    hour12: false,
  });
  const hour = Number(fmt.format(new Date()));
  if (!Number.isInteger(hour)) return false;
  return hour < CUTOFF_HOUR;
}

export function EarlyDataWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(isBeforeCutoffInCatalunya());
  }, []);

  if (!show) return null;

  return (
    <Alert className="border-amber-300 bg-amber-50">
      <Clock className="size-4 text-amber-700" />
      <AlertTitle className="text-amber-900">Dades possiblement amb un dia de delay</AlertTitle>
      <AlertDescription className="text-amber-900/80">
        Les dades de la gran majoria de reports s&apos;agafen del repositori
        diari i pot ser que abans de les 10:00 del matí encara no s&apos;hagi
        completat el volcat de dades. Si això passés, estaries mirant dades
        amb un dia de delay.
      </AlertDescription>
    </Alert>
  );
}
