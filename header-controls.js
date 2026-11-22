const menuButton=document.querySelector("#home-menu-toggle");
const nav=document.querySelector("#main-nav");
const menuPanel=document.querySelector("#site-menu-panel");
const searchButton=document.querySelector("#home-search-toggle");
const searchPanel=document.querySelector("#home-search-panel");
const searchInput=document.querySelector("#home-search-input");
const searchMessage=document.querySelector("#home-search-message");
function setMenu(open){
 if(!menuPanel||!menuButton)return;
 menuPanel.hidden=!open;
 menuButton.setAttribute("aria-expanded",String(open));
 menuButton.setAttribute("aria-label",open?"Close menu":"Open menu");
 document.body.classList.toggle("menu-open",open);
 if(open)menuPanel.querySelector(".site-menu-close")?.focus();
 else menuButton.focus();
}
menuButton?.addEventListener("click",()=>setMenu(menuPanel?.hidden??true));
menuPanel?.querySelectorAll("[data-menu-close]").forEach(button=>button.addEventListener("click",()=>setMenu(false)));
menuPanel?.querySelectorAll(".site-menu-drawer a").forEach(link=>link.addEventListener("click",()=>setMenu(false)));
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&menuPanel&&!menuPanel.hidden)setMenu(false);});
searchButton?.addEventListener("click",()=>{
 const open=searchPanel.hidden;
 searchPanel.hidden=!open;
 searchButton.setAttribute("aria-expanded",String(open));
 if(open)searchInput?.focus();
});
searchInput?.addEventListener("keydown",event=>{
 if(event.key!=="Enter")return;
 const term=searchInput.value.trim().toLocaleLowerCase();
 if(!term){searchMessage.textContent="Please enter something to search.";return;}
 const candidates=[...document.querySelectorAll(".collection-card, .home-product-card")];
 const match=candidates.find(card=>card.textContent.toLocaleLowerCase().includes(term));
 if(match){searchMessage.textContent="Matching collection found.";match.scrollIntoView({behavior:"smooth",block:"center"});searchPanel.hidden=true;searchButton?.setAttribute("aria-expanded","false");}
 else{searchMessage.textContent="No matching collection found. Try Ladies, Gents or Fabrics.";}
});

 // Keep collection shortcuts explicit and independent of the menu's close
 // handler. Preserve the selected language in localStorage, then navigate to
 // the same-origin shop page with a validated collection key.
 document.addEventListener("click",event=>{
  const link=event.target?.closest?.('a[href*="shop.html?collection="]');
  if(!link)return;
  const destination=new URL(link.getAttribute("href"),window.location.href);
  if(destination.origin!==window.location.origin||!destination.pathname.endsWith("/shop.html"))return;
  const collection=destination.searchParams.get("collection");
  if(!["ladies","gents","fabrics","unisex"].includes(collection))return;
  event.preventDefault();
  if(menuPanel&&!menuPanel.hidden)setMenu(false);
  const language=(()=>{try{return localStorage.getItem("maryam_luxe_language_v1")||"en";}catch{return "en";}})();
  destination.searchParams.set("lang",["en","ur","ar","fr","de","es"].includes(language)?language:"en");
  window.location.assign(destination.href);
 });
