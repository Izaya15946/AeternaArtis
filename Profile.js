import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIefhfw87VtaK_BtSHli0OPAksm1wqQ1s",
  authDomain: "aeterna-artis-618a2.firebaseapp.com",
  projectId: "aeterna-artis-618a2",
  storageBucket: "aeterna-artis-618a2.firebasestorage.app",
  messagingSenderId: "793700191025",
  appId: "1:793700191025:web:4272ade31590f5d0aebe10"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyb37MoxtUfKle3NtuwBWsuk01lCQYsNcRkyJy_3IFKGaKYLu-Uw_Z-COctGfQHtTip/exec";

async function uploadToDrive(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const payload = {
          base64: reader.result,
          mimeType: file.type,
          fileName: `${Date.now()}_${file.name}`
        };

        const response = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.status === "success") {
          resolve(result.url);
        } else {
          reject(new Error(result.message));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

function updateProfileImages(imageUrl) {
  if (!imageUrl) return;
  const images = document.querySelectorAll(".profile-pic");
  images.forEach(img => {
    img.src = imageUrl;
  });
}

function updateProfileNames(fullname) {
  if (!fullname) return;
  const nameElements = document.querySelectorAll(".prof-name");
  nameElements.forEach(el => {
    el.textContent = fullname;
  });
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  return dateString.includes("T") ? dateString.split("T")[0] : dateString;
}

document.addEventListener("DOMContentLoaded", function() {
  const userEmail = localStorage.getItem("userEmail");
  const storedUser = localStorage.getItem("userProfile");

  if (!userEmail) {
    alert("Please log in first!");
    window.location.href = "index.html";
    return;
  }

  if (storedUser) {
    const user = JSON.parse(storedUser);
    updateProfileNames(user.fullname);
    if (user.imageUrl) {
      updateProfileImages(user.imageUrl);
    }

    if (document.getElementById("prof-birthday")) document.getElementById("prof-birthday").textContent = formatDate(user.birthday);
    if (document.getElementById("prof-country")) document.getElementById("prof-country").textContent = user.country || "N/A";
    if (document.getElementById("prof-email")) document.getElementById("prof-email").textContent = user.email || userEmail;
  }

  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", function(e) {
      e.preventDefault();
      fileInput.click();
    });

    fileInput.addEventListener("change", function(e) {
      const file = e.target.files[0];
      if (!file) return;

      const isConfirmed = confirm(`Do you want to upload "${file.name}" as your profile picture?`);
      if (isConfirmed) {
        handleImageUpload(file);
      } else {
        fileInput.value = "";
      }
    });
  }

  const logoutBtn = document.getElementById("navLogout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async function(e) {
      e.preventDefault();
      try {
        await signOut(auth);
        localStorage.clear();
        window.location.href = "index.html";
      } catch (err) {
        console.error("Logout error:", err);
      }
    });
  }

  const wrapper = document.getElementById("profileDropdownWrapper");
  const menu = document.getElementById("profileMenu");
  const profileImg = document.getElementById("profileImg");
  const viewProfileBtn = document.getElementById("viewProfileBtn");

  if (wrapper && menu) {
    wrapper.addEventListener("click", function(e) {
      e.stopPropagation();
      menu.classList.toggle("show");
    });
  }

  document.addEventListener("click", function() {
    if (menu) menu.classList.remove("show");
  });

  if (viewProfileBtn && profileImg) {
    viewProfileBtn.addEventListener("click", function(e) {
      e.preventDefault();
      if (typeof openLightbox === "function") {
        openLightbox(profileImg.src);
      } else {
        window.open(profileImg.src, "_blank");
      }
    });
  }
});

async function handleImageUpload(file) {
  const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
  const fileInput = document.getElementById("fileInput");

  if (!file) {
    alert("No file provided.");
    return;
  }

  if (!storedUser.uid) {
    alert("User ID not found in local session. Please log in again.");
    return;
  }

  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) uploadBtn.textContent = "Uploading to Drive...";

  try {
    const downloadURL = await uploadToDrive(file);

    // 1. Update the user document in Firestore
    const userRef = doc(db, "users", storedUser.uid);
    await updateDoc(userRef, { imageUrl: downloadURL });

    // 2. Query and batch-update all posts created by this user
    uploadBtn.textContent = "Updating posts...";
    const currentUserEmail = storedUser.email || localStorage.getItem("userEmail");
    const postsRef = collection(db, "posts");
    const q = query(postsRef, where("email", "==", currentUserEmail));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const batch = writeBatch(db);
      querySnapshot.forEach((postDoc) => {
        batch.update(postDoc.ref, { userImageUrl: downloadURL });
      });
      await batch.commit();
    }

    alert("Profile picture updated successfully across all posts!");
    updateProfileImages(downloadURL);
    storedUser.imageUrl = downloadURL;
    localStorage.setItem("userProfile", JSON.stringify(storedUser));
  } catch (err) {
    console.error("Upload error details:", err);
    alert("Upload failed: " + err.message);
  } finally {
    if (uploadBtn) uploadBtn.textContent = "Upload Photo";
    if (fileInput) fileInput.value = "";
  }
}