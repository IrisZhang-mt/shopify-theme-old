// find #footer-logo-back-to-top, if exist, click it to go back to the top:
const backToTop = document.querySelector("#footer-logo-back-to-top");
if (backToTop) {
  backToTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });
}

// check if this is a touch device:
function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
}

document.addEventListener("DOMContentLoaded", function () {
  if (isTouchDevice()) {
    // document.body.classList.add('touch-device');
  } else {
    document.body.classList.add("no-touch-device");
  }
});
