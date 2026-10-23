import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc,
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

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOj93h99MIHba04PjHSbs8zjoJsdpAqOenqq0r2KpbuMEIUHK8l4vNfmUIee0uKyzfow/exec";

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

function formatBioText(text) {
  if (!text) return "No bio yet.";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" style="color: var(--accent-color); text-decoration: underline;">${url}</a>`;
  });
}

function applyGlobalSettings(profileData) {
  const heroContainer = document.getElementById("heroBannerContainer");
  if (heroContainer) {
    if (profileData.hideHero) {
      heroContainer.style.display = "none";
    } else {
      heroContainer.style.display = "flex";
    }
  }
}

document.addEventListener("DOMContentLoaded", async function() {
  const currentUserEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();
  
  if (!currentUserEmail) {
    alert("Please log in first!");
    window.location.href = "index.html";
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const targetEmailParam = urlParams.get("email");
  const targetUidParam = urlParams.get("uid");

  let profileData = null;

  if (targetEmailParam || targetUidParam) {
    try {
      const usersRef = collection(db, "users");
      const querySnapshot = await getDocs(usersRef);
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const docEmail = data.email ? data.email.toLowerCase().trim() : "";
        if (targetEmailParam && docEmail === targetEmailParam.toLowerCase().trim()) {
          profileData = data;
        } else if (targetUidParam && data.uid === targetUidParam) {
          profileData = data;
        }
      });
    } catch (err) {
      console.error("Error fetching target profile:", err);
    }
  }

  if (!profileData && !targetEmailParam && !targetUidParam) {
    const storedUserStr = localStorage.getItem("userProfile");
    if (storedUserStr) {
      profileData = JSON.parse(storedUserStr);
    }
  }

  if (profileData) {
    applyGlobalSettings(profileData);

    const uname = profileData.email ? profileData.email.split("@")[0] : "user";
    
    const targetImg = document.getElementById("targetProfileImg");
    if (targetImg) {
      targetImg.src = profileData.imageUrl ? profileData.imageUrl : "Profile-Placeholder.png";
    }

    const bannerImg = document.getElementById("profileBannerImg") || document.getElementById("targetProfileBannerImg");
    if (bannerImg) {
      if (profileData.bannerUrl) {
        bannerImg.src = profileData.bannerUrl;
        bannerImg.style.display = "block";
      } else {
        bannerImg.style.display = "none";
      }
    }

    const bannerInput = document.getElementById("profileBannerInput");
    if (bannerInput) {
      bannerInput.value = profileData.bannerUrl || "";
    }

    const targetName = document.getElementById("targetProfileName");
    if (targetName) {
      targetName.textContent = profileData.fullname || "User";
      if (profileData.nameFont) targetName.style.fontFamily = profileData.nameFont;
      targetName.style.color = "var(--text-main)";
    }

    const targetUsername = document.getElementById("targetProfileUsername");
    if (targetUsername) {
      targetUsername.textContent = `@${uname}`;
    }

    const targetBio = document.getElementById("targetProfileBio");
    if (targetBio) {
      targetBio.innerHTML = formatBioText(profileData.bio);
    }

    document.querySelectorAll(".prof-name").forEach(el => { 
      el.textContent = profileData.fullname; 
      if (profileData.nameFont) el.style.fontFamily = profileData.nameFont;
      el.style.color = "var(--text-main)";
    });

    document.querySelectorAll(".prof-username").forEach(el => {
      el.textContent = `@${uname}`;
    });

    document.querySelectorAll(".profile-pic").forEach(img => {
      if (img.id !== "targetProfileImg") {
        img.src = profileData.imageUrl ? profileData.imageUrl : "Profile-Placeholder.png";
      }
    });

    if (document.getElementById("profileBioInput")) {
      document.getElementById("profileBioInput").value = profileData.bio || "";
    }
    if (document.getElementById("artistToggleCheckbox")) {
      document.getElementById("artistToggleCheckbox").checked = profileData.isArtist || false;
    }
    if (document.getElementById("nsfwUnblurToggleCheckbox")) {
      document.getElementById("nsfwUnblurToggleCheckbox").checked = profileData.unblurNsfw || false;
    }
    if (document.getElementById("hideHeroToggleCheckbox")) {
      document.getElementById("hideHeroToggleCheckbox").checked = profileData.hideHero || false;
    }
    if (document.getElementById("profileFontSelect") && profileData.nameFont) {
      document.getElementById("profileFontSelect").value = profileData.nameFont;
    }
    
    const bioDisplay = document.getElementById("prof-bio-display");
    if (bioDisplay) {
      bioDisplay.innerHTML = formatBioText(profileData.bio);
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
      const bannerUrlVal = document.getElementById("profileBannerInput")?.value.trim() || "";
      const isArtistStatus = document.getElementById("artistToggleCheckbox").checked;
      const unblurNsfwStatus = document.getElementById("nsfwUnblurToggleCheckbox")?.checked || false;
      const hideHeroStatus = document.getElementById("hideHeroToggleCheckbox")?.checked || false;
      const nameFontVal = document.getElementById("profileFontSelect")?.value || "system-ui, sans-serif";

      saveProfileBtn.textContent = "Saving...";
      saveProfileBtn.disabled = true;

      try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, {
          bio: bioText,
          bannerUrl: bannerUrlVal,
          isArtist: isArtistStatus,
          unblurNsfw: unblurNsfwStatus,
          hideHero: hideHeroStatus,
          nameFont: nameFontVal
        });

        currentUser.bio = bioText;
        currentUser.bannerUrl = bannerUrlVal;
        currentUser.isArtist = isArtistStatus;
        currentUser.unblurNsfw = unblurNsfwStatus;
        currentUser.hideHero = hideHeroStatus;
        currentUser.nameFont = nameFontVal;
        localStorage.setItem("userProfile", JSON.stringify(currentUser));

        const postsRef = collection(db, "posts");
        const q = query(postsRef, where("email", "==", currentUserEmail));
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

        const bannerImg = document.getElementById("profileBannerImg") || document.getElementById("targetProfileBannerImg");
        if (bannerImg) {
          if (bannerUrlVal) {
            bannerImg.src = bannerUrlVal;
            bannerImg.style.display = "block";
          } else {
            bannerImg.style.display = "none";
          }
        }

        document.getElementById("editProfileModal").style.display = "none";
        alert("Profile & settings updated successfully!");
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

  // CLEAN POPUP LIGHTBOX FOR PROFILE PHOTO (SINGLE CENTERED IMAGE)
  if (viewProfileBtn && profileImg) {
    viewProfileBtn.addEventListener("click", function(e) {
      e.preventDefault();
      
      const modal = document.getElementById("igPostDetailModal");
      const modalImg = document.getElementById("igModalImg");
      const modalRight = modal ? modal.querySelector(".ig-modal-right") : null;
      const modalContainer = modal ? modal.querySelector(".ig-modal-container") : null;

      if (modal && modalImg) {
        modalImg.src = profileImg.src;
        
        if (modalRight) {
          modalRight.style.display = "none";
        }

        if (modalContainer) {
          modalContainer.style.maxWidth = "550px";
          modalContainer.style.height = "auto";
          modalContainer.style.maxHeight = "85vh";
        }

        modal.style.display = "flex";
      } else {
        window.open(profileImg.src, "_blank");
      }
    });
  }
});

// RESTORE MODAL LAYOUT WHEN CLOSING
window.closeIgModal = function() {
  const modal = document.getElementById("igPostDetailModal");
  if (modal) {
    modal.style.display = "none";
    const modalRight = modal.querySelector(".ig-modal-right");
    const modalContainer = modal.querySelector(".ig-modal-container");
    
    if (modalRight) {
      modalRight.style.display = "flex";
    }
    if (modalContainer) {
      modalContainer.style.maxWidth = "1050px";
      modalContainer.style.height = "85vh";
      modalContainer.style.maxHeight = "750px";
    }
  }
};

async function handleImageUpload(file) {
  const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
  const fileInput = document.getElementById("fileInput");

  if (!file || !storedUser.uid) return;

  const uploadBtn = document.getElementById("uploadBtn");
  if (uploadBtn) uploadBtn.textContent = "Uploading...";

  const oldImageUrl = storedUser.imageUrl;

  try {
    const downloadURL = await uploadToDrive(file);

    const userRef = doc(db, "users", storedUser.uid);
    await updateDoc(userRef, { imageUrl: downloadURL });

    if (oldImageUrl && !oldImageUrl.includes("Profile-Placeholder.png")) {
      try {
        await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({ action: "delete", url: oldImageUrl })
        });
      } catch (delErr) {
        console.warn("Could not delete old profile picture from Drive:", delErr);
      }
    }

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

    const targetImg = document.getElementById("targetProfileImg");
    if (targetImg) targetImg.src = downloadURL;

    document.querySelectorAll(".profile-pic").forEach(img => {
      img.src = downloadURL;
    });

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