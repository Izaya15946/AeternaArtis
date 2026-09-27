import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion, 
  query, 
  where, 
  serverTimestamp 
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

let globalPosts = [];
let activeFilters = {
  category: "All",
  postType: "All"
};

document.addEventListener("DOMContentLoaded", function() {
  const userEmail = localStorage.getItem("userEmail");
  const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
  const isProfilePage = window.location.pathname.toLowerCase().includes("accountprofile.html");

  const currentUserAvatar = storedUser.imageUrl || document.querySelector(".profile-pic")?.src || "";

  const barAvatar = document.querySelector(".create-post-bar img");
  if (barAvatar && currentUserAvatar) {
    barAvatar.src = currentUserAvatar;
  }

  fetchPosts(isProfilePage ? userEmail : null);

  const modal = document.getElementById("postModal");
  const openBtn = document.getElementById("openModalBtn");
  const closeBtn = document.getElementById("closeModalBtn");
  const submitBtn = document.getElementById("submitModalPostBtn");
  const fileInput = document.getElementById("modalImageInput");
  const previewContainer = document.getElementById("imagePreviewContainer");
  const previewImg = document.getElementById("imagePreview");

  if (openBtn && modal) {
    openBtn.onclick = () => { modal.style.display = "flex"; };
  }

  if (closeBtn && modal) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
      resetModalFields();
    };
  }

  if (fileInput) {
    fileInput.addEventListener("change", function() {
      const file = this.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          previewImg.src = e.target.result;
          previewContainer.style.display = "block";
        };
        reader.readAsDataURL(file);
      } else {
        previewContainer.style.display = "none";
        previewImg.src = "";
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", async function() {
      const content = document.getElementById("modalContent").value.trim();
      const category = document.getElementById("modalCategory").value;
      const postType = document.getElementById("modalPostType").value;
      const file = fileInput ? fileInput.files[0] : null;

      if (!content && !file) {
        alert("Please add text or select an image.");
        return;
      }

      submitBtn.innerText = "Posting...";
      submitBtn.disabled = true;

      try {
        let postImageUrl = "";

        if (file) {
          submitBtn.innerText = "Uploading to Drive...";
          postImageUrl = await uploadToDrive(file);
        }

        await addDoc(collection(db, "posts"), {
          email: userEmail,
          fullname: storedUser.fullname || document.querySelector(".prof-name")?.innerText || "User",
          userImageUrl: storedUser.imageUrl || currentUserAvatar,
          content: content,
          postImageUrl: postImageUrl,
          category: category,
          postType: postType,
          comments: [],
          createdAt: serverTimestamp()
        });

        submitBtn.innerText = "Post";
        submitBtn.disabled = false;
        modal.style.display = "none";
        resetModalFields();
        fetchPosts(isProfilePage ? userEmail : null);
      } catch (err) {
        console.error("Error creating post:", err);
        submitBtn.innerText = "Post";
        submitBtn.disabled = false;
        alert("An error occurred while creating the post: " + err.message);
      }
    });
  }

  function resetModalFields() {
    if (document.getElementById("modalContent")) document.getElementById("modalContent").value = "";
    if (fileInput) fileInput.value = "";
    if (previewContainer) previewContainer.style.display = "none";
    if (previewImg) previewImg.src = "";
  }
});

async function fetchPosts(filterEmail) {
  try {
    const postsRef = collection(db, "posts");
    let q;

    if (filterEmail) {
      q = query(postsRef, where("email", "==", filterEmail));
    } else {
      q = postsRef;
    }

    const querySnapshot = await getDocs(q);
    globalPosts = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      data.postId = doc.id;
      globalPosts.push(data);
    });

    globalPosts.sort((a, b) => {
      const timeA = a.createdAt?.seconds || Date.now();
      const timeB = b.createdAt?.seconds || Date.now();
      return timeB - timeA;
    });

    applyFiltersAndRender();
  } catch (err) {
    console.error("Error fetching posts:", err);
  }
}

window.filterPosts = function(type, value) {
  activeFilters[type] = value;
  const sidebarClass = type === 'postType' ? '.leftsidebar' : '.rightsidebar';
  document.querySelectorAll(`${sidebarClass} .filter-btn`).forEach(btn => {
    if (btn.innerText.trim() === value || (value === 'All' && btn.innerText.includes('All'))) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  applyFiltersAndRender();
};

function applyFiltersAndRender() {
  const filtered = globalPosts.filter(post => {
    const matchCategory = activeFilters.category === "All" || post.category === activeFilters.category;
    const matchType = activeFilters.postType === "All" || post.postType === activeFilters.postType;
    return matchCategory && matchType;
  });

  renderFeed(filtered);
}

function renderFeed(posts) {
  const feedContainer = document.getElementById("feedContainer");
  if (!feedContainer) return;
  feedContainer.innerHTML = "";

  if (!posts || posts.length === 0) {
    feedContainer.innerHTML = "<p style='color: gray; text-align: center; margin-top: 20px;'>No posts yet.</p>";
    return;
  }

  const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0a0b0'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.04-4.84-2.6.03-.99 2.01-1.53 3.34-1.53 1.33 0 3.31.54 3.34 1.53-1.04 1.56-2.81 2.6-4.84 2.6z'/></svg>";

  posts.forEach(post => {
    const postDiv = document.createElement("div");
    postDiv.className = "container-post";

    const avatarSrc = (post.userImageUrl && post.userImageUrl !== "") ? post.userImageUrl : defaultAvatar;
    const postImgTag = post.postImageUrl 
      ? `<div class="post-image-wrapper">
          <img src="${post.postImageUrl}" class="post-image" alt="Post artwork" style="cursor: pointer;" onclick="openLightbox('${post.postImageUrl}')">
        </div>` 
      : "";

    const isSelling = post.postType === "Selling";
    const postTypeStyle = isSelling ? "background: #ff4d4d; color: #ffffff;" : "background: #00ffc8; color: #0f0f11;";

    let commentsHtml = "";
    if (post.comments && post.comments.length > 0) {
      post.comments.forEach(c => {
        const commenterAvatar = (c.imageUrl && c.imageUrl !== "") ? c.imageUrl : defaultAvatar;

        commentsHtml += `
          <div class="comment-item">
            <img src="${commenterAvatar}" class="comment-avatar" alt="${c.fullname}">
            <div class="comment-content">
              <span class="comment-author">${c.fullname}</span>
              <span>${c.comment}</span>
            </div>
          </div>
        `;
      });
    }

    postDiv.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <img src="${avatarSrc}" class="profile-pic" style="width:44px; height:44px; border-radius:50%; object-fit:cover;">
        <div>
          <h4 style="margin:0; color:#fff;">${post.fullname}</h4>
          <div style="display:flex; gap:8px; margin-top:6px;">
            <span style="font-size:13px; font-weight:600; background:#26262e; color:#00ffc8; padding:4px 10px; border-radius:12px;">${post.category}</span>
            <span style="font-size:13px; font-weight:bold; ${postTypeStyle} padding:4px 10px; border-radius:12px;">${post.postType}</span>
          </div>
        </div>
      </div>
      <p class="post-text">${post.content}</p>
      ${postImgTag}
      
      <div style="margin-top:15px; border-top:1px solid #2a2a30; padding-top:10px;">
        <div id="comments-list-${post.postId}">${commentsHtml}</div>
        <div class="comment-box-container">
          <input type="text" id="input-${post.postId}" placeholder="Write a comment...">
          <button type="button" onclick="submitComment('${post.postId}')">Comment</button>
        </div>
      </div>
    `;

    feedContainer.appendChild(postDiv);
  });
}

window.submitComment = async function(postId) {
  const input = document.getElementById(`input-${postId}`);
  const commentText = input.value.trim();
  const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
  const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0a0b0'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.04-4.84-2.6.03-.99 2.01-1.53 3.34-1.53 1.33 0 3.31.54 3.34 1.53-1.04 1.56-2.81 2.6-4.84 2.6z'/></svg>";

  if (!commentText) return;

  const currentAvatar = storedUser.imageUrl || document.querySelector(".prof-img")?.src || "";

  const commentObj = {
    fullname: storedUser.fullname || document.querySelector(".prof-name")?.innerText || "User",
    imageUrl: currentAvatar,
    comment: commentText,
    timestamp: new Date().toISOString()
  };

  try {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      comments: arrayUnion(commentObj)
    });

    input.value = "";
    const commentsList = document.getElementById(`comments-list-${postId}`);
    const commenterAvatar = commentObj.imageUrl !== "" ? commentObj.imageUrl : defaultAvatar;
    
    commentsList.innerHTML += `
      <div class="comment-item">
        <img src="${commenterAvatar}" class="comment-avatar" alt="${commentObj.fullname}">
        <div class="comment-content">
          <span class="comment-author">${commentObj.fullname}</span>
          <span>${commentText}</span>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Error adding comment:", err);
    alert("Failed to submit comment: " + err.message);
  }
};

window.openLightbox = function(imageSrc) {
  const lightbox = document.getElementById("imageLightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  if (lightbox && lightboxImg) {
    lightboxImg.src = imageSrc;
    lightbox.style.display = "flex";
  }
};

window.closeLightbox = function() {
  const lightbox = document.getElementById("imageLightbox");
  if (lightbox) {
    lightbox.style.display = "none";
  }
};