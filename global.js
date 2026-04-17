console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// select all links inside nav
let navLinks = $$("nav a");
console.log(navLinks);

// print them in console for checking
console.log(navLinks);