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

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyOZv7lbiB10OcXUgTOTssMkmECUJK5KsM4_iXLZevLxwbVO4jmcNtMFpGnbyskn5HDMg/exec";

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
  const images = document.querySelectorAll(".profile-pic");
  images.forEach(img => {
    // Explicit fallback: if imageUrl is empty, null, or undefined, use the placeholder
    img.src = imageUrl ? imageUrl : "Profile-Placeholder.png";
  });
}

function formatBioText(text) {
  if (!text) return "No bio yet.";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" style="color: var(--accent-color); text-decoration: underline;">${url}</a>`;
  });
}

document.addEventListener("DOMContentLoaded", function() {
  const userEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();
  const storedUserStr = localStorage.getItem("userProfile");

  if (!userEmail) {
    alert("Please log in first!");
    window.location.href = "index.html";
    return;
  }

  if (storedUserStr) {
    const user = JSON.parse(storedUserStr);
    const uname = user.email ? user.email.split("@")[0] : "user";
    
    document.querySelectorAll(".prof-name").forEach(el => { 
      el.textContent = user.fullname; 
      if (user.nameFont) el.style.fontFamily = user.nameFont;
      el.style.color = "var(--text-main)";
    });

    document.querySelectorAll(".prof-username").forEach(el => {
      el.textContent = `@${uname}`;
    });

    // Pass the image URL or empty string to correctly trigger the placeholder fallback
    updateProfileImages(user.imageUrl);

    if (document.getElementById("profileBioInput")) {
      document.getElementById("profileBioInput").value = user.bio || "";
    }
    if (document.getElementById("artistToggleCheckbox")) {
      document.getElementById("artistToggleCheckbox").checked = user.isArtist || false;
    }
    if (document.getElementById("nsfwUnblurToggleCheckbox")) {
      document.getElementById("nsfwUnblurToggleCheckbox").checked = user.unblurNsfw || false;
    }
    if (document.getElementById("profileFontSelect") && user.nameFont) {
      document.getElementById("profileFontSelect").value = user.nameFont;
    }
    
    const bioDisplay = document.getElementById("prof-bio-display");
    if (bioDisplay) {
      bioDisplay.innerHTML = formatBioText(user.bio);
    }
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

  const saveProfileBtn = document.getElementById("saveProfileBtn");
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async function() {
      const currentUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
      if (!currentUser.uid) {
        alert("User ID not found. Please log in again.");
        return;
      }

      const bioText = document.getElementById("profileBioInput").value.trim();
      const isArtistStatus = document.getElementById("artistToggleCheckbox").checked;
      const unblurNsfwStatus = document.getElementById("nsfwUnblurToggleCheckbox")?.checked || false;
      const nameFontVal = document.getElementById("profileFontSelect")?.value || "system-ui, sans-serif";

      saveProfileBtn.textContent = "Saving...";
      saveProfileBtn.disabled = true;

      try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
          bio: bioText,
          isArtist: isArtistStatus,
          unblurNsfw: unblurNsfwStatus,
          nameFont: nameFontVal
        });

        currentUser.bio = bioText;
        currentUser.isArtist = isArtistStatus;
        currentUser.unblurNsfw = unblurNsfwStatus;
        currentUser.nameFont = nameFontVal;
        localStorage.setItem("userProfile", JSON.stringify(currentUser));

        const postsRef = collection(db, "posts");
        const q = query(postsRef, where("email", "==", userEmail));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((pDoc) => {
            batch.update(pDoc.ref, { bio: bioText, isArtist: isArtistStatus, nameFont: nameFontVal });
          });
          await batch.commit();
        }

        const bioDisplay = document.getElementById("prof-bio-display");
        if (bioDisplay) {
          bioDisplay.innerHTML = formatBioText(bioText);
        }

        document.getElementById("editProfileModal").style.display = "none";
        alert("Profile updated successfully!");
        location.reload();
      } catch (err) {
        console.error("Error saving profile:", err);
        alert("Failed to save: " + err.message);
      } finally {
        saveProfileBtn.textContent = "Save changes";
        saveProfileBtn.disabled = false;
      }
    });
  }

  const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
  if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener("click", async function() {
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
      window.open(profileImg.src, "_blank");
    });
  }
});

async function handleImageUpload(file) {
  const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
  const fileInput = document.getElementById("fileInput");

  if (!file || !storedUser.uid) return;

  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) uploadBtn.textContent = "Uploading...";

  try {
    const downloadURL = await uploadToDrive(file);

    const userRef = doc(db, "users", storedUser.uid);
    await updateDoc(userRef, { imageUrl: downloadURL });

    const currentUserEmail = (storedUser.email || localStorage.getItem("userEmail") || "").toLowerCase().trim();
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

    updateProfileImages(downloadURL);
    storedUser.imageUrl = downloadURL;
    localStorage.setItem("userProfile", JSON.stringify(storedUser));
    alert("Profile picture updated!");
  } catch (err) {
    console.error("Upload error:", err);
    alert("Upload failed: " + err.message);
  } finally {
    if (uploadBtn) uploadBtn.textContent = "Upload Photo";
    if (fileInput) fileInput.value = "";
  }
}
