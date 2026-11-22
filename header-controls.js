const menuButton=document.querySelector("#home-menu-toggle");
const nav=document.querySelector("#main-nav");
const searchButton=document.querySelector("#home-search-toggle");
const searchPanel=document.querySelector("#home-search-panel");
const searchInput=document.querySelector("#home-search-input");
const searchMessage=document.querySelector("#home-search-message");
menuButton?.addEventListener("click",()=>{
 const open=nav.classList.toggle("is-open");
 menuButton.setAttribute("aria-expanded",String(open));
 menuButton.setAttribute("aria-label",open?"Close menu":"Open menu");
});
nav?.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>{
 nav.classList.remove("is-open");
 menuButton?.setAttribute("aria-expanded","false");
}));
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
