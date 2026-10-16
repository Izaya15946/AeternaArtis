import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
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

let globalPosts = [];
let globalUsers = [];
let activeFilters = { category: "All", postType: "All" };
let currentActiveTab = "posts";

function formatBioText(text) {
  if (!text) return "No bio yet.";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" style="color: var(--accent-color); text-decoration: underline;">${url}</a>`;
  });
}

document.addEventListener("DOMContentLoaded", async function() {
  await fetchAllUsers();
  await fetchPosts();
  updateProfileHeaderCounts();

  const modal = document.getElementById("postModal");
  const floatingCreateBtn = document.getElementById("floatingCreatePostBtn");
  const closeBtn = document.getElementById("closeModalBtn");
  const submitBtn = document.getElementById("submitModalPostBtn");
  const fileInput = document.getElementById("modalImageInput");
  const previewContainer = document.getElementById("imagePreviewContainer");
  const previewImg = document.getElementById("imagePreview");
  const removePreviewBtn = document.getElementById("removePreviewImgBtn");
  const postTypeSelect = document.getElementById("modalPostType");
  const contactGroup = document.getElementById("contactLinkGroup");

  const modalUserAvatar = document.getElementById("modalUserAvatar");
  const modalUserName = document.getElementById("modalUserName");
  const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");

  if (modalUserName) {
    modalUserName.textContent = storedUser.fullname || "User";
    if (storedUser.nameFont) modalUserName.style.fontFamily = storedUser.nameFont;
    modalUserName.style.color = "var(--text-main)";
  }
  if (modalUserAvatar && storedUser.imageUrl) modalUserAvatar.src = storedUser.imageUrl;

  function handlePostTypeChange() {
    if (!postTypeSelect || !contactGroup) return;
    const type = postTypeSelect.value;
    contactGroup.style.display = (type === "Selling" || type === "Open Commission") ? "flex" : "none";
  }

  if (postTypeSelect) postTypeSelect.addEventListener("change", handlePostTypeChange);

  if (floatingCreateBtn && modal) {
    floatingCreateBtn.onclick = () => { 
      modal.style.display = "flex"; 
      handlePostTypeChange();
    };
  }

  const closeModal = () => {
    if (modal) modal.style.display = "none";
    resetModalFields();
  };

  if (closeBtn) closeBtn.onclick = closeModal;

  if (fileInput) {
    fileInput.addEventListener("change", function() {
      const file = this.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          if (previewImg) previewImg.src = e.target.result;
          if (previewContainer) previewContainer.style.display = "block";
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (removePreviewBtn) {
    removePreviewBtn.onclick = () => {
      if (fileInput) fileInput.value = "";
      if (previewImg) previewImg.src = "";
      if (previewContainer) previewContainer.style.display = "none";
    };
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", async function() {
      const content = document.getElementById("modalContent").value.trim();
      const category = document.getElementById("modalCategory").value;
      const postType = document.getElementById("modalPostType").value;
      const rating = document.getElementById("modalNsfwRating")?.value || "SFW";
      const contactLink = document.getElementById("modalContactLink")?.value.trim() || "";
      const file = fileInput ? fileInput.files[0] : null;
      const userEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();

      if (!content && !file) {
        alert("Please add text or select an image.");
        return;
      }

      if ((postType === "Selling" || postType === "Open Commission") && !contactLink) {
        alert("Please provide a contact or purchase link for Selling or Open Commission posts.");
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
          fullname: storedUser.fullname || "User",
          userImageUrl: storedUser.imageUrl || "",
          isArtist: storedUser.isArtist || false, 
          bio: storedUser.bio || "",
          nameFont: storedUser.nameFont || "system-ui, sans-serif",
          content: content,
          postImageUrl: postImageUrl,
          category: category,
          postType: postType,
          rating: rating,
          contactLink: contactLink,
          likes: [], 
          comments: [],
          createdAt: serverTimestamp()
        });

        submitBtn.innerText = "Post";
        submitBtn.disabled = false;
        closeModal();
        fetchPosts();
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
    if (document.getElementById("modalContactLink")) document.getElementById("modalContactLink").value = "";
    if (fileInput) fileInput.value = "";
    if (previewImg) previewImg.src = "";
    if (previewContainer) previewContainer.style.display = "none";
  }
});

async function fetchAllUsers() {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    globalUsers = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      data.userId = docSnap.id;
      if (data.email) data.email = data.email.toLowerCase().trim();
      globalUsers.push(data);
    });

    const currentUserEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();
    const currentUserDoc = globalUsers.find(u => u.email === currentUserEmail);
    if (currentUserDoc) {
      const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
      storedUser.following = currentUserDoc.following || [];
      localStorage.setItem("userProfile", JSON.stringify(storedUser));
    }
  } catch (err) {
    console.error("Error fetching users:", err);
  }
}

async function fetchPosts() {
  try {
    const postsRef = collection(db, "posts");
    const querySnapshot = await getDocs(postsRef);
    globalPosts = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      data.postId = doc.id;
      if (data.email) data.email = data.email.toLowerCase().trim();
      globalPosts.push(data);
    });

    globalPosts.sort((a, b) => {
      const timeA = a.createdAt?.seconds || Date.now();
      const timeB = b.createdAt?.seconds || Date.now();
      return timeB - timeA;
    });

    refreshCurrentView();
  } catch (err) {
    console.error("Error fetching posts:", err);
  }
}

function refreshCurrentView() {
  const pathname = window.location.pathname.toLowerCase();
  if (pathname.includes("search.html")) {
    const urlParams = new URLSearchParams(window.location.search);
    renderSearchResults(urlParams.get('q') || '');
  } else if (pathname.includes("userprofile.html")) {
    const urlParams = new URLSearchParams(window.location.search);
    renderTargetUserProfile(urlParams.get('email') || '');
  } else {
    updateProfileHeaderCounts();
    applyFiltersAndRender();
  }
}

function updateProfileHeaderCounts() {
  const isAccountPage = window.location.pathname.toLowerCase().includes("accountprofile.html");
  if (!isAccountPage) return;

  const currentUserEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();
  const currentUserDoc = globalUsers.find(u => u.email === currentUserEmail) || {};
  const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");

  const userPosts = globalPosts.filter(p => p.email === currentUserEmail);
  const postsCountElem = document.getElementById("myPostsCount");
  if (postsCountElem) postsCountElem.textContent = userPosts.length;

  const followingList = currentUserDoc.following || storedUser.following || [];
  const followingCountElem = document.getElementById("followingCount");
  if (followingCountElem) followingCountElem.textContent = followingList.length;

  const followersList = globalUsers.filter(u => u.following && u.following.includes(currentUserEmail));
  const followersCountElem = document.getElementById("followersCount");
  if (followersCountElem) followersCountElem.textContent = followersList.length;
}

function renderTargetUserProfile(targetEmail) {
  targetEmail = targetEmail.toLowerCase().trim();
  const currentUserEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();
  
  if (targetEmail === currentUserEmail) {
    window.location.href = "AccountProfile.html";
    return;
  }

  const userPosts = globalPosts.filter(p => p.email === targetEmail);
  const targetUserObj = globalUsers.find(u => u.email === targetEmail) || {};
  
  if (userPosts.length > 0 || targetUserObj.email) {
    const postData = userPosts[0] || {};
    const profileNameElem = document.getElementById("targetProfileName");
    const profileUsernameElem = document.getElementById("targetProfileUsername");
    const profileImgElem = document.getElementById("targetProfileImg");
    const profileBioElem = document.getElementById("targetProfileBio");
    const postsCountElem = document.getElementById("targetPostsCount");
    const followersCountElem = document.getElementById("targetFollowersCount");
    const followingCountElem = document.getElementById("targetFollowingCount");
    
    const fullName = targetUserObj.fullname || postData.fullname || "User";
    const nameFont = targetUserObj.nameFont || postData.nameFont || "";
    const userImg = targetUserObj.imageUrl || postData.userImageUrl || "";
    const bioText = targetUserObj.bio || postData.bio || "No bio yet.";

    if (profileNameElem) {
      profileNameElem.textContent = fullName;
      if (nameFont) profileNameElem.style.fontFamily = nameFont;
      profileNameElem.style.color = "var(--text-main)";
    }
    
    if (profileUsernameElem) {
      const uname = targetEmail.split("@")[0];
      profileUsernameElem.textContent = `@${uname}`;
    }

    if (profileImgElem && userImg) {
      profileImgElem.src = userImg;
    }

    if (profileBioElem) {
      profileBioElem.innerHTML = formatBioText(bioText);
    }

    if (postsCountElem) {
      postsCountElem.textContent = userPosts.length;
    }

    const targetFollowing = targetUserObj.following || [];
    if (followingCountElem) {
      followingCountElem.textContent = targetFollowing.length;
    }

    const targetFollowers = globalUsers.filter(u => u.following && u.following.includes(targetEmail));
    if (followersCountElem) {
      followersCountElem.textContent = targetFollowers.length;
    }
  }

  const actionContainer = document.getElementById("targetFollowActionContainer");
  const currentUserDoc = globalUsers.find(u => u.email === currentUserEmail) || {};
  const followingList = currentUserDoc.following || [];

  if (actionContainer && currentUserEmail !== targetEmail) {
    const isFollowing = followingList.includes(targetEmail);
    actionContainer.innerHTML = `
      <button type="button" class="follow-btn ${isFollowing ? 'following' : ''}" onclick="toggleFollowUser('${targetEmail}')" style="padding: 8px 20px; font-size: 14px;">
        ${isFollowing ? 'Following' : '+ Follow'}
      </button>
    `;
  }

  const container = document.getElementById("targetUserFeedContainer");
  if (container) renderFeedInContainer(userPosts, container);
}

window.toggleFollowUser = async function(targetEmail) {
  targetEmail = targetEmail.toLowerCase().trim();
  const currentUserEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();
  
  if (targetEmail === currentUserEmail) {
    alert("You cannot follow yourself!");
    return;
  }

  const currentUserDoc = globalUsers.find(u => u.email === currentUserEmail);
  if (!currentUserDoc || !currentUserDoc.userId) {
    alert("User account document not found. Please log in again.");
    return;
  }

  if (!currentUserDoc.following) {
    currentUserDoc.following = [];
  }

  const idx = currentUserDoc.following.indexOf(targetEmail);
  if (idx > -1) {
    currentUserDoc.following.splice(idx, 1);
  } else {
    currentUserDoc.following.push(targetEmail);
  }

  try {
    const userRef = doc(db, "users", currentUserDoc.userId);
    await updateDoc(userRef, { following: currentUserDoc.following });

    const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
    storedUser.following = currentUserDoc.following;
    localStorage.setItem("userProfile", JSON.stringify(storedUser));

    await fetchAllUsers();
    refreshCurrentView();
  } catch (err) {
    console.error("Error updating follow state:", err);
    alert("Failed to update follow state: " + err.message);
  }
};

function renderSearchResults(queryStr) {
  const container = document.getElementById("searchResultsContainer");
  const summary = document.getElementById("searchSummaryText");
  if (!container) return;

  const q = queryStr.toLowerCase().trim();
  const matched = globalPosts.filter(p => {
    return (p.content && p.content.toLowerCase().includes(q)) ||
           (p.fullname && p.fullname.toLowerCase().includes(q)) ||
           (p.category && p.category.toLowerCase().includes(q)) ||
           (p.postType && p.postType.toLowerCase().includes(q));
  });

  if (summary) summary.textContent = `Found ${matched.length} post(s) matching "${queryStr}"`;
  renderFeedInContainer(matched, container);
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

window.switchProfileTab = function(tabName) {
  currentActiveTab = tabName;
  const tabs = document.querySelectorAll(".profile-tab-btn");
  tabs.forEach(tab => tab.classList.remove("active"));
  
  const selectedBtn = document.getElementById(`tab-btn-${tabName}`);
  if (selectedBtn) selectedBtn.classList.add("active");

  applyFiltersAndRender();
};

function applyFiltersAndRender() {
  const pathname = window.location.pathname.toLowerCase();
  const currentUserEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();

  let postsToProcess = globalPosts;

  if (pathname.includes("accountprofile.html")) {
    if (currentActiveTab === "posts") {
      postsToProcess = globalPosts.filter(p => p.email === currentUserEmail);
    } else if (currentActiveTab === "gallery") {
      const galleryPosts = globalPosts.filter(p => p.email === currentUserEmail && p.postImageUrl);
      renderGalleryGrid(galleryPosts);
      return;
    } else if (currentActiveTab === "liked") {
      postsToProcess = globalPosts.filter(p => p.likes && p.likes.includes(currentUserEmail));
    }
  }

  const filtered = postsToProcess.filter(post => {
    const matchCategory = activeFilters.category === "All" || post.category === activeFilters.category;
    const matchType = activeFilters.postType === "All" || post.postType === activeFilters.postType;
    return matchCategory && matchType;
  });

  const feedContainer = document.getElementById("feedContainer");
  if (feedContainer) renderFeedInContainer(filtered, feedContainer);
}

function renderFeedInContainer(posts, container) {
  container.innerHTML = "";

  if (!posts || posts.length === 0) {
    container.innerHTML = "<p style='color: gray; text-align: center; margin-top: 20px;'>No posts found.</p>";
    return;
  }

  const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0a0b0'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.04-4.84-2.6.03-.99 2.01-1.53 3.34-1.53 1.33 0 3.31.54 3.34 1.53-1.04 1.56-2.81 2.6-4.84 2.6z'/></svg>";
  const currentUserEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();
  const currentUserDoc = globalUsers.find(u => u.email === currentUserEmail) || {};
  const followingList = currentUserDoc.following || [];

  posts.forEach(post => {
    const postDiv = document.createElement("div");
    postDiv.className = "container-post";

    const avatarSrc = (post.userImageUrl && post.userImageUrl !== "") ? post.userImageUrl : defaultAvatar;
    const isUserTheAuthor = post.email === currentUserEmail;
    const effectiveIsArtist = isUserTheAuthor ? (JSON.parse(localStorage.getItem("userProfile") || "{}").isArtist || false) : (post.isArtist || false);
    const isArtistBadge = effectiveIsArtist ? `<span style="background: #e0a96d; color: #000; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">ARTIST</span>` : "";
    
    const nameFontStyle = post.nameFont ? `style="font-family: ${post.nameFont}; color: var(--text-main); text-decoration: none;"` : `style="color: var(--text-main); text-decoration: none;"`;
    const profileTargetLink = isUserTheAuthor ? "AccountProfile.html" : `UserProfile.html?email=${encodeURIComponent(post.email)}`;
    
    const isNsfw = post.rating === "NSFW";
    const nsfwBadge = isNsfw ? `<span class="nsfw-badge">NSFW 18+</span>` : "";

    let followBtnHtml = "";
    if (!isUserTheAuthor) {
      const isFollowing = followingList.includes(post.email);
      followBtnHtml = `
        <button type="button" class="follow-btn ${isFollowing ? 'following' : ''}" onclick="toggleFollowUser('${post.email}')">
          ${isFollowing ? 'Following' : '+ Follow'}
        </button>
      `;
    }

    const deletePostOption = isUserTheAuthor ? `
      <div class="comment-options-wrapper" style="position:relative; margin-left:auto;">
        <button type="button" class="comment-options-btn" onclick="toggleCommentMenu(event, '${post.postId}', 'card_menu')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;">
          <i class="fa-solid fa-ellipsis"></i>
        </button>
        <div id="menu-${post.postId}-card_menu" class="comment-dropdown-menu">
          <button type="button" class="comment-delete-item" onclick="deletePost('${post.postId}')">Delete</button>
        </div>
      </div>
    ` : "";

    let postImgTag = "";
    if (post.postImageUrl) {
      const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const autoUnblur = storedUser.unblurNsfw || false;
      const shouldBlur = isNsfw && !autoUnblur;

      postImgTag = `
        <div class="post-image-container-relative" id="img-wrapper-${post.postId}">
          <img src="${post.postImageUrl}" class="post-image ${shouldBlur ? 'blurred-nsfw-img' : ''}" id="img-elem-${post.postId}" onclick="openIgModal('${post.postId}')" style="cursor: pointer;">
          ${shouldBlur ? `
            <div class="nsfw-overlay-warning" id="nsfw-overlay-${post.postId}" onclick="unblurSingleImage('${post.postId}')">
              <i class="fa-solid fa-eye-slash"></i>
              <span>Sensitive Content (18+)</span>
              <small style="margin-top:4px; opacity:0.8;">Click to reveal artwork</small>
            </div>
          ` : ''}
        </div>
      `;
    }

    let actionBtn = "";
    if (post.postType === "Selling" || post.postType === "Open Commission") {
      const buttonText = post.postType === "Selling" ? "Buy Artwork" : "Request Commission";
      const targetLink = post.contactLink || "#";
      actionBtn = `
        <div style="margin-top: 12px;">
          <a href="${targetLink}" target="_blank" style="display: inline-block; background: #00ffc8; color: #000; font-weight: bold; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px;">
            <i class="fa fa-shopping-cart"></i> ${buttonText}
          </a>
        </div>
      `;
    }

    const likesArray = post.likes || [];
    const likesCount = likesArray.length;
    const isLiked = likesArray.includes(currentUserEmail);
    const commentsCount = post.comments ? post.comments.length : 0;

    const heartIconClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    const heartColor = isLiked ? '#ff4d4d' : '#a0a0b0';

    postDiv.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <a href="${profileTargetLink}" style="text-decoration:none; display:flex; align-items:center; gap:12px; color:inherit;">
          <img src="${avatarSrc}" class="profile-pic" style="width:44px; height:44px; border-radius:50%; object-fit:cover;">
        </a>
        <div style="flex-grow: 1;">
          <h4 style="margin:0; color:var(--text-main); display:flex; align-items:center;">
            <a href="${profileTargetLink}" ${nameFontStyle}>${post.fullname}</a>
            ${isArtistBadge}
            ${nsfwBadge}
          </h4>
          <span style="font-size:11px; color:var(--text-muted);">${post.category} • ${post.postType}</span>
        </div>
        ${followBtnHtml}
        ${deletePostOption}
      </div>
      <p class="post-text">${post.content}</p>
      ${postImgTag}
      ${actionBtn}
      
      <div class="post-actions-bar" style="display:flex; gap:16px; margin-top:12px; align-items:center;">
        <button type="button" onclick="toggleLike('${post.postId}')" class="like-btn ${isLiked ? 'liked' : ''}" style="background:none; border:none; cursor:pointer; font-size:16px; color: ${heartColor}; padding:0; display:flex; align-items:center; gap:6px;">
          <i class="${heartIconClass}" style="font-size:20px;"></i>
          <span style="font-size:13px; font-weight:600;">${likesCount}</span>
        </button>
        <button type="button" onclick="openIgModal('${post.postId}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px; display:flex; align-items:center; gap:6px;">
          <i class="fa-regular fa-comment" style="font-size:20px;"></i> <span style="font-size:13px; font-weight:600;">${commentsCount}</span>
        </button>
      </div>
    `;

    container.appendChild(postDiv);
  });
}

window.unblurSingleImage = function(postId) {
  const img = document.getElementById(`img-elem-${postId}`);
  const overlay = document.getElementById(`nsfw-overlay-${postId}`);
  if (img) img.classList.remove("blurred-nsfw-img");
  if (overlay) overlay.style.display = "none";
};

function renderGalleryGrid(posts) {
  const feedContainer = document.getElementById("feedContainer");
  if (!feedContainer) return;

  if (posts.length === 0) {
    feedContainer.innerHTML = "<p style='color: gray; text-align: center; margin-top: 20px;'>No artwork found in gallery.</p>";
    return;
  }

  let gridHtml = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px;">`;
  posts.forEach(post => {
    gridHtml += `
      <div style="aspect-ratio: 1/1; overflow: hidden; border-radius: 8px; cursor: pointer;" onclick="openIgModal('${post.postId}')">
        <img src="${post.postImageUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Artwork Grid">
      </div>
    `;
  });
  gridHtml += `</div>`;
  feedContainer.innerHTML = gridHtml;
}

function renderCommentTree(comments, postId, postOwnerEmail, currentUserEmail, defaultAvatar) {
  if (!comments || comments.length === 0) return "";

  return comments.map((c, index) => {
    const avatar = (c.imageUrl && c.imageUrl !== "") ? c.imageUrl : defaultAvatar;
    const canDelete = (currentUserEmail === postOwnerEmail) || (currentUserEmail === c.email);
    const commentId = c.commentId || index;

    const deleteOptionHtml = canDelete ? `
      <div class="comment-options-wrapper" style="position:relative;">
        <button type="button" class="comment-options-btn" onclick="toggleCommentMenu(event, '${postId}', '${commentId}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px;">
          <i class="fa-solid fa-ellipsis"></i>
        </button>
        <div id="menu-${postId}-${commentId}" class="comment-dropdown-menu">
          <button type="button" class="comment-delete-item" onclick="deleteComment('${postId}', '${commentId}')">Delete</button>
        </div>
      </div>
    ` : "";

    return `
      <div class="comment-thread" data-comment-id="${commentId}" style="margin-bottom: 12px; display:flex; gap:10px; align-items:flex-start;">
        <img src="${avatar}" class="comment-avatar" alt="${c.fullname}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
        <div class="comment-bubble" style="flex:1; background:var(--input-bg); padding:8px 12px; border-radius:12px;">
          <div class="comment-header-row" style="display:flex; justify-content:space-between; align-items:center;">
            <span class="comment-author" style="font-weight:bold; color:var(--text-main); font-size:12px;">${c.fullname}</span>
            ${deleteOptionHtml}
          </div>
          <p style="margin: 4px 0; font-size: 13px; color: var(--text-main);">${c.comment}</p>
        </div>
      </div>
    `;
  }).join("");
}

window.toggleCommentMenu = function(event, postId, commentId) {
  event.stopPropagation();
  document.querySelectorAll('.comment-dropdown-menu').forEach(m => {
    if (m.id !== `menu-${postId}-${commentId}`) m.classList.remove('show');
  });
  const menu = document.getElementById(`menu-${postId}-${commentId}`);
  if (menu) menu.classList.toggle('show');
};

window.addEventListener('click', () => {
  document.querySelectorAll('.comment-dropdown-menu').forEach(m => m.classList.remove('show'));
});

window.toggleLike = async function(postId) {
  const currentUserEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();
  if (!currentUserEmail) {
    alert("Please log in to like posts.");
    return;
  }

  const post = globalPosts.find(p => p.postId === postId);
  if (!post) {
    alert("Post not found.");
    return;
  }

  if (!post.likes) post.likes = [];
  if (post.likes.includes(currentUserEmail)) {
    post.likes = post.likes.filter(email => email !== currentUserEmail);
  } else {
    post.likes.push(currentUserEmail);
  }

  try {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, { likes: post.likes });

    refreshCurrentView();
    const igModal = document.getElementById("igPostDetailModal");
    if (igModal && igModal.style.display === "flex") {
      openIgModal(postId);
    }
  } catch (err) {
    console.error("Error updating likes in Firestore:", err);
    alert("Firestore Save Failed: " + err.message);
  }
};

window.deletePost = async function(postId) {
  if (!confirm("Are you sure you want to delete this post?")) return;
  const post = globalPosts.find(p => p.postId === postId);
  if (!post) return;

  try {
    if (post.postImageUrl) {
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete", url: post.postImageUrl })
      });
    }

    await deleteDoc(doc(db, "posts", postId));
    globalPosts = globalPosts.filter(p => p.postId !== postId);
    
    refreshCurrentView();
    closeIgModal();
  } catch (err) {
    console.error("Error deleting post:", err);
    alert("Delete Failed: " + err.message);
  }
};

window.deleteComment = async function(postId, commentId) {
  if (!confirm("Are you sure you want to delete this comment?")) return;

  const post = globalPosts.find(p => p.postId === postId);
  if (!post) return;

  post.comments = post.comments.filter(c => c.commentId !== commentId);

  try {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, { comments: post.comments });
    
    refreshCurrentView();
    openIgModal(postId);
  } catch (err) {
    console.error("Error deleting comment:", err);
    alert("Comment Delete Failed: " + err.message);
  }
};

window.openIgModal = function(postId) {
  const post = globalPosts.find(p => p.postId === postId);
  if (!post) return;

  const modal = document.getElementById("igPostDetailModal");
  if (!modal) return;
  const modalContainer = modal.querySelector(".ig-modal-container");
  const modalImg = document.getElementById("igModalImg");
  const modalHeader = document.getElementById("igModalHeader");
  const commentsBody = document.getElementById("igModalCommentsBody");
  const likeBtn = document.getElementById("igModalLikeBtn");
  const likesCountSpan = document.getElementById("igModalLikesCount");
  const submitCommentBtn = document.getElementById("igModalSubmitCommentBtn");
  const commentInput = document.getElementById("igModalCommentInput");

  const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0a0b0'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.04-4.84-2.6.03-.99 2.01-1.53 3.34-1.53 1.33 0 3.31.54 3.34 1.53-1.04 1.56-2.81 2.6-4.84 2.6z'/></svg>";
  const avatarSrc = (post.userImageUrl && post.userImageUrl !== "") ? post.userImageUrl : defaultAvatar;
  
  const currentUserEmail = (localStorage.getItem("userEmail") || "").toLowerCase().trim();
  const isUserTheAuthor = post.email === currentUserEmail;
  const profileTargetLink = isUserTheAuthor ? "AccountProfile.html" : `UserProfile.html?email=${encodeURIComponent(post.email)}`;

  if (post.postImageUrl && post.postImageUrl !== "") {
    modalImg.src = post.postImageUrl;
    modalContainer.classList.remove("no-image");
  } else {
    modalImg.src = "";
    modalContainer.classList.add("no-image");
  }

  const deletePostOption = isUserTheAuthor ? `
    <div class="comment-options-wrapper" style="position:relative; margin-left:auto;">
      <button type="button" class="comment-options-btn" onclick="toggleCommentMenu(event, '${postId}', 'post_menu')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px;">
        <i class="fa-solid fa-ellipsis"></i>
      </button>
      <div id="menu-${postId}-post_menu" class="comment-dropdown-menu">
        <button type="button" class="comment-delete-item" onclick="deletePost('${postId}')">Delete</button>
      </div>
    </div>
  ` : "";

  const nameFontStyle = post.nameFont ? `style="font-family: ${post.nameFont}; color: var(--text-main); text-decoration: none;"` : `style="color: var(--text-main); text-decoration: none;"`;

  modalHeader.innerHTML = `
    <a href="${profileTargetLink}" style="text-decoration:none; display:flex; align-items:center; gap:12px; color:inherit;">
      <img src="${avatarSrc}" class="profile-pic" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
    </a>
    <div>
      <h4 style="margin:0; font-size:14px; color:var(--text-main);">
        <a href="${profileTargetLink}" ${nameFontStyle}>${post.fullname}</a>
      </h4>
      <span style="font-size:11px; color:var(--text-muted);">${post.category} • ${post.postType}</span>
    </div>
    ${deletePostOption}
  `;

  const likesArray = post.likes || [];
  const likesCount = likesArray.length;
  const isLiked = likesArray.includes(currentUserEmail);

  const modalHeartClass = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  const modalHeartColor = isLiked ? '#ff4d4d' : '#a0a0b0';

  if (likesCountSpan) {
    likesCountSpan.textContent = `${likesCount} likes`;
  }

  if (likeBtn) {
    likeBtn.className = `like-btn ${isLiked ? 'liked' : ''}`;
    likeBtn.innerHTML = `<i class="${modalHeartClass}" style="font-size: 20px; color: ${modalHeartColor}; cursor: pointer;"></i>`;
    likeBtn.onclick = async () => {
      await toggleLike(postId);
    };
  }

  let commentsHtml = `
    <div style="display:flex; gap:10px; align-items:flex-start; padding-bottom:12px; border-bottom:1px solid var(--border-color);">
      <img src="${avatarSrc}" class="comment-avatar" alt="${post.fullname}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">
      <div style="font-size:13px; color:var(--text-main);">
        <strong style="margin-right:6px;"><a href="${profileTargetLink}" ${nameFontStyle}>${post.fullname}</a></strong>
        ${post.content}
      </div>
    </div>
  `;

  commentsHtml += renderCommentTree(post.comments || [], postId, post.email, currentUserEmail, defaultAvatar);
  commentsBody.innerHTML = commentsHtml;

  if (submitCommentBtn && commentInput) {
    const newSubmitBtn = submitCommentBtn.cloneNode(true);
    submitCommentBtn.parentNode.replaceChild(newSubmitBtn, submitCommentBtn);

    newSubmitBtn.onclick = async () => {
      const text = commentInput.value.trim();
      if (!text) return;

      const storedUser = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const commentObj = {
        commentId: "c_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        email: currentUserEmail,
        fullname: storedUser.fullname || "User",
        imageUrl: storedUser.imageUrl || "",
        comment: text,
        timestamp: new Date().toISOString()
      };

      if (!post.comments) post.comments = [];
      post.comments.push(commentObj);

      try {
        const postRef = doc(db, "posts", postId);
        await updateDoc(postRef, { comments: post.comments });
        commentInput.value = "";
        
        refreshCurrentView();
        openIgModal(postId);
      } catch (err) {
        console.error("Error posting comment:", err);
        alert("Firestore Comment Failed: " + err.message);
      }
    };
  }

  modal.style.display = "flex";
};

window.closeIgModal = function() {
  const modal = document.getElementById("igPostDetailModal");
  if (modal) modal.style.display = "none";
};