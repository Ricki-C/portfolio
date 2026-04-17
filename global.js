console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// select all links inside nav
let navLinks = $$("nav a");
console.log(navLinks);

// find the nav link that matches the current page URL
let currentLink = navLinks.find(
  (a) => a.host === location.host && a.pathname === location.pathname,
);

console.log(currentLink);

// add the current class to the matched nav link
currentLink?.classList.add("current");

