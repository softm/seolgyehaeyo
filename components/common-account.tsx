"use client";
import {useEffect} from "react";
export default function CommonAccount(){
  useEffect(()=>{
    if(document.getElementById("common-site-account-script"))return;
    const script=document.createElement("script");script.id="common-site-account-script";script.type="module";
    script.src="https://softm.github.io/shared/platform/v1/boot.mjs?site=seolgyehaeyo&v=20261029-account-1";
    document.body.appendChild(script);
  },[]);
  return null;
}
