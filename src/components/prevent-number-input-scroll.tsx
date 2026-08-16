"use client";

import { useEffect } from "react";

export default function PreventNumberInputScroll() {
    useEffect(() => {
        function stopWheelChanges(event: WheelEvent) {
            const target = event.target;

            if (
                target instanceof HTMLInputElement &&
                target.type === "number" &&
                document.activeElement === target
            ) {
                target.blur();
            }
        }

        document.addEventListener("wheel", stopWheelChanges, {
            capture: true,
            passive: true,
        });

        return () => {
            document.removeEventListener("wheel", stopWheelChanges, true);
        };
    }, []);

    return null;
}
