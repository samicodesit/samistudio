"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PurchaseDialogProps } from "./purchase-dialog";
import type { WebPack, WebPackCatalog } from "@/lib/billing/web-packs";
import type { AccountSummary } from "@/app/api/account/route";
import { hasPurchaseWording } from "@/lib/purchase-wording";
import { fillPackText, getPackCopy } from "@/lib/pack-copy";
import { GoogleSignInButton, isIosBrowser } from "./google-sign-in-button";
import { ApplePayCheckout } from "./apple-pay-checkout";
import "./web-pack-purchase-dialog.css";
const IDS = ["pack_mini", "pack_regular", "pack_big"];
function validCatalog(value: unknown): value is WebPackCatalog {
  if (!value || typeof value !== "object") return false;
  const c=value as WebPackCatalog;
  return typeof c.offerEnd === "string" && Number.isFinite(Date.parse(c.offerEnd)) && Array.isArray(c.packs) && c.packs.length===3 && c.packs.every((p,i)=>p.productId===IDS[i] && p.currency==="EUR" && p.unitAmount===[199,499,999][i] && p.normalCredits===[6,20,60][i] && p.credits===(i===1 && p.offerApplied?25:p.normalCredits) && typeof p.offerApplied==="boolean");
}
export function WebPackPurchaseDialog({open,account,scene,locale,copy,errorMessage,confirmationBusy=false,paymentPending=false,onRetryConfirmation,onRestoreFocus,onClose,onAccountChange,onExpressCheckoutComplete,onBeforeCheckout}: PurchaseDialogProps) {
  const inCheckout=useRef(false), refreshedExpiry=useRef<string|null>(null);
  const text=getPackCopy(locale), dialog=useRef<HTMLDialogElement>(null), previous=useRef<HTMLElement|null>(null), live=useRef(false);
  const [catalog,setCatalog]=useState<WebPackCatalog|null>(null), [loading,setLoading]=useState(true), [busy,setBusy]=useState(false), [walletBusy,setWalletBusy]=useState(false), [error,setError]=useState<string|null>(null), [signIn,setSignIn]=useState(false);
  const [selected,setSelected]=useState(()=>{try{const saved=sessionStorage.getItem("doodle:pack-selection");return saved && IDS.includes(saved)?saved:"pack_regular";}catch{return "pack_regular";}});
  const [pastPurchase]=useState(hasPurchaseWording);
  useEffect(()=>{inCheckout.current=busy||walletBusy||confirmationBusy||paymentPending;},[busy,walletBusy,confirmationBusy,paymentPending]);
  useEffect(()=>{if(signIn)dialog.current?.querySelector<HTMLElement>("h2")?.focus({preventScroll:true});},[signIn]);
  const selectedPack=catalog?.packs.find(p=>p.productId===selected);
  const price=(pack:WebPack,each=false)=>new Intl.NumberFormat(locale,{style:"currency",currency:pack.currency}).format(pack.unitAmount/100/(each?pack.credits:1));
  const refresh=useCallback(async()=>{
    const response=await fetch("/api/checkout/catalog",{cache:"no-store"});
    const next:unknown=await response.json();
    if(!response.ok || !validCatalog(next))throw new Error("catalog unavailable");
    if(live.current)setCatalog(next);
    return next;
  },[]);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{await refresh();}catch{if(live.current)setError(text.unavailable);}finally{if(live.current)setLoading(false);}},[refresh,text.unavailable]);
  useEffect(()=>{
    if(!open)return;live.current=true;previous.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const node=dialog.current;if(typeof node?.showModal==="function")node.showModal();else node?.setAttribute("open","");
    node?.querySelector<HTMLElement>("h2")?.focus({preventScroll:true});queueMicrotask(()=>{if(live.current)void load();});
    const resume=()=>{if(document.visibilityState==="visible"&&!inCheckout.current)void load();};document.addEventListener("visibilitychange",resume);
    return()=>{live.current=false;document.removeEventListener("visibilitychange",resume);if(node?.open && typeof node.close==="function")node.close();if(onRestoreFocus)onRestoreFocus();else previous.current?.focus();};
  },[open,load,onRestoreFocus]);
  useEffect(()=>{
    if(!open || !catalog?.packs.some(p=>p.offerApplied))return;
    const delay=Date.parse(catalog.offerEnd)-Date.now()+1;
    if(delay>2147483647 || refreshedExpiry.current===catalog.offerEnd)return;
    const timer=setTimeout(()=>{refreshedExpiry.current=catalog.offerEnd;if(!inCheckout.current)void load();},Math.max(0,delay));return()=>clearTimeout(timer);
  },[open,catalog,load]);
  const saveReturn=async(intent:"auth"|"checkout")=>{
    await onBeforeCheckout?.();
    sessionStorage.setItem("doodle:pack-selection",selected);
    sessionStorage.setItem("doodle:return",JSON.stringify({scene,intent,path:location.pathname}));
  };
  const begin=async(authenticated=account.authenticated)=>{
    if(busy || walletBusy || confirmationBusy || paymentPending || !selectedPack)return;
    setBusy(true);setError(null);
    let redirected = false;
    try {
      const fresh=await refresh(), pack=fresh.packs.find(p=>p.productId===selected)!;
      if(pack.credits!==selectedPack.credits || pack.unitAmount!==selectedPack.unitAmount){setError(text.offerChanged);return;}
      await saveReturn(authenticated?"checkout":"auth");
      if(!authenticated){setSignIn(true);return;}
      const response=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locale,productId:pack.productId,expectedCredits:pack.credits})});
      if(response.status===409){await refresh();setError(text.offerChanged);return;}
      const body=await response.json() as {url?:unknown};
      if(!response.ok || typeof body.url!=="string" || !body.url.startsWith("https://checkout.stripe.com/"))throw new Error("checkout unavailable");
      location.assign(body.url);
      redirected = true;
    }catch{setError(copy.purchase.checkoutError);}finally{if(live.current && !redirected)setBusy(false);}
  };
  const authenticate=async(credential:string)=>{
    setBusy(true);setError(null);
    let redirected = false;
    try {
      const response=await fetch("/api/auth/google",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential})});
      if(!response.ok)throw new Error("auth unavailable");
      const nextResponse=await fetch("/api/account",{cache:"no-store",headers:{"x-doodle-packs":"v1"}}), next=await nextResponse.json() as AccountSummary;
      if(!nextResponse.ok || !next.authenticated)throw new Error("auth unavailable");
      onAccountChange(next);setSignIn(false);
      // Continue the same selected pack without a second sign-in confirmation.
      const fresh=await refresh(), pack=fresh.packs.find(p=>p.productId===selected)!;
      if(pack.credits!==selectedPack?.credits){setError(text.offerChanged);return;}
      await saveReturn("checkout");
      const checkout=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locale,productId:pack.productId,expectedCredits:pack.credits})});
      if(checkout.status===409){await refresh();setError(text.offerChanged);return;}
      const body=await checkout.json() as {url?:unknown};
      if(!checkout.ok || typeof body.url!=="string" || !body.url.startsWith("https://checkout.stripe.com/"))throw new Error("checkout unavailable");
      location.assign(body.url);
      redirected = true;
    }catch{setError(copy.purchase.checkoutError);}finally{if(live.current && !redirected)setBusy(false);}
  };
  if(!open)return null;
  const processing=busy||walletBusy||confirmationBusy||paymentPending;
  const disabled=processing||(!onRetryConfirmation&&(loading||!selectedPack));
  return <dialog ref={dialog} className="web-pack-dialog" dir={locale==="ar"?"rtl":"ltr"} aria-labelledby="web-pack-title" onCancel={event=>{event.preventDefault();if(!busy&&!walletBusy&&(!confirmationBusy||paymentPending))onClose();}}>
    <header className="web-pack-heading"><h2 id="web-pack-title" tabIndex={-1}>{text.title}</h2><p>{account.balance===0 && account.freeRemaining===0 ? account.hasPurchased===true||(!account.authenticated&&pastPurchase)?text.returning:account.hasPurchased===false || !account.authenticated?text.first:null:null} {text.terms}</p></header>
    <div className="web-pack-scroll">
      {signIn?<div className="web-pack-auth"><GoogleSignInButton locale={locale} busy={busy} loadingLabel={copy.auth.loading} redirect={isIosBrowser()} onCredential={authenticate} onError={()=>setError(copy.auth.authError)}/></div>:loading?<p role="status">{text.loading}</p>:catalog?<div role="radiogroup" aria-label={text.title} className="web-pack-cards">{catalog.packs.map((pack,i)=><button type="button" role="radio" aria-checked={selected===pack.productId} tabIndex={selected===pack.productId?0:-1} onKeyDown={event=>{const delta=event.key==="ArrowDown"||event.key==="ArrowRight"?1:event.key==="ArrowUp"||event.key==="ArrowLeft"?-1:0;if(delta && !disabled){event.preventDefault();const next=(i+delta+3)%3;setSelected(IDS[next]);(event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();}}} className={`web-pack-card${selected===pack.productId?" is-selected":""}${i===1?" is-recommended":""}`} key={pack.productId} disabled={processing} onClick={()=>{setSelected(pack.productId);setError(null);try{sessionStorage.setItem("doodle:pack-selection",pack.productId);}catch{}}}>
        <span className="web-pack-card-top"><strong>{[text.mini,text.regular,text.big][i]}</strong>{i>0?<span className="web-pack-badge">{i===1?text.recommended:text.bestValue}</span>:null}</span>
        <span className="web-pack-card-price"><strong>{fillPackText(getPackCopy(locale,pack.credits).quantity,{count:pack.credits})}</strong><strong dir="ltr">{price(pack)}</strong></span>
        <span className="web-pack-each">{fillPackText(text.each,{price:price(pack,true)})}</span><span className="web-pack-caption">{[text.miniCaption,text.regularCaption,text.bigCaption][i]}</span>
        {pack.offerApplied?<span className="web-pack-offer">{fillPackText(text.offer,{count:pack.credits,normal:pack.normalCredits,date:new Intl.DateTimeFormat(locale==="en"?"en-GB":locale,{day:"numeric",month:"short",timeZone:"Europe/Amsterdam"}).format(new Date(catalog.offerEnd))})}</span>:null}
      </button>)}</div>:null}
      {!signIn && catalog ? <p className="web-pack-reassurance">{text.neverExpire} {text.failedFree}</p> : null}
      {!signIn&&account.authenticated&&selectedPack&&!loading&&!onRetryConfirmation&&onExpressCheckoutComplete?<ApplePayCheckout key={`${selected}:${selectedPack.credits}:${catalog?.offerEnd}`} locale={locale} productId={selectedPack.productId} expectedCredits={selectedPack.credits} ariaLabel={copy.purchase.applePay} unavailableMessage={copy.purchase.checkoutError} onComplete={onExpressCheckoutComplete} onError={setError} onBusyChange={setWalletBusy} onBeforeConfirm={()=>saveReturn("checkout")}/>:null}
      {error||errorMessage?<p role="alert" className="web-pack-error">{error??errorMessage}</p>:null}
      {!loading&&!catalog?<button className="purchase-text-action" onClick={()=>void load()}>{copy.actions.tryAgain}</button>:null}
    </div>
    <footer className="web-pack-footer">
      {!signIn?<button className={`purchase-primary web-pack-buy${processing?" is-loading":""}`} type="button" disabled={disabled} aria-busy={processing} onClick={()=>onRetryConfirmation?onRetryConfirmation():void begin()}>{processing?text.processing:onRetryConfirmation?copy.actions.tryAgain:selectedPack?fillPackText(getPackCopy(locale,selectedPack.credits).buy,{count:selectedPack.credits,price:price(selectedPack)}):text.loading}</button>:null}
      <button className="web-pack-dismiss" type="button" disabled={busy||walletBusy||(confirmationBusy&&!paymentPending)} onClick={onClose}>{text.notNow}</button>
    </footer>
  </dialog>;
}
