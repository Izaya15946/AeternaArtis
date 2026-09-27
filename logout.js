
document.addEventListener("DOMContentLoaded", function() {
  const logoutBtn = document.getElementById("navLogout");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function(e) {
      e.preventDefault();   // Prevents '#' link jump
      localStorage.clear();  // Clears user session
      window.location.href = "index.html"; // Redirects to login
    });
  }
});
