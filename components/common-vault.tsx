"use client";
import { useEffect } from "react";
export default function CommonVault() {
  useEffect(() => {
    if (document.getElementById("common-site-vault-script")) return;
    const script = document.createElement("script");
    script.id = "common-site-vault-script"; script.type = "module";
    script.src = "https://softm.github.io/shared/platform/v1/boot.mjs?site=seolgyehaeyo&v=20261028";
    document.body.append(script);
  }, []);
  return <div data-suite-vault-anchor="" aria-label="공통 계정과 보관소" style={{ position: "fixed", right: 20, bottom: 142, zIndex: 25 }} />;
}
