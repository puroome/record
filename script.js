/* script.js */

const firebaseConfig = {
  apiKey: "AIzaSyDzAYguXSjmjNJFEYPplLKUj_twhOO0Llk",
  authDomain: "record-99cf0.firebaseapp.com",
  databaseURL: "https://record-99cf0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "record-99cf0",
  storageBucket: "record-99cf0.firebasestorage.app",
  messagingSenderId: "127235673442",
  appId: "1:127235673442:web:7ebee7c66698c81b70703b"
};

// Firebase 초기화는 HTML에서 라이브러리를 불러온 후 실행되므로 안전함
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const MASTER_PW = "rhkdska25"; 

var currentId = "";
var currentName = "";
var globalScoreData = null; 
var onModalConfirm = null;
var isAutoFilling = false;
var fetchedStudentData = null; 
var myChart = null; 
var serverVersion = 0; 

document.addEventListener('contextmenu', function(event) { event.preventDefault(); });

window.addEventListener('load', function() {
    checkAppVersion();
    history.replaceState({ step: 'step1' }, 'step1', '');
});

window.onpopstate = function(event) {
    document.querySelectorAll('.step-area').forEach(el => el.style.display = 'none');
    document.getElementById('step3-result').style.display = 'none';
    
    var showMainTitle = true;
    if (event.state && event.state.step) {
        var target = event.state.step;
        if (target === 'step3') {
            document.getElementById('step3-result').style.display = 'block';
            document.querySelector('.container').style.maxWidth = 'none'; 
            showMainTitle = false;
        } else if (target === 'step2-login' || target === 'step2-register') {
            document.getElementById(target).style.display = 'block';
            document.querySelector('.container').style.maxWidth = '500px';
        } else {
            document.getElementById('step1').style.display = 'block';
            document.querySelector('.container').style.maxWidth = '500px';
        }
    } else {
        document.getElementById('step1').style.display = 'block';
        document.querySelector('.container').style.maxWidth = '500px';
    }
    document.getElementById('mainTitle').style.display = showMainTitle ? 'block' : 'none';
};

function checkAppVersion() {
  db.ref('info').once('value').then(function(snapshot) {
    if (snapshot.exists()) {
      var info = snapshot.val();
      var sVer = info.version;       
      var sDate = info.lastUpdated;  
      document.getElementById('lastUpdatedDisplay').innerText = "Update: " + sDate;
      
      var localVer = localStorage.getItem('cached_version');
      if (String(localVer) !== String(sVer)) {
        console.log("새로운 데이터가 감지되었습니다. 캐시를 초기화합니다.");
        localStorage.removeItem('cached_student_data'); 
      }
      serverVersion = sVer; 
    }
  }).catch(function(err) {
    console.log("버전 확인 실패: " + err);
    var localDate = localStorage.getItem('cached_date_str');
    if(localDate) {
       document.getElementById('lastUpdatedDisplay').innerText = "Update: " + localDate + " (Offline)";
    }
  });
}

// --- 모달 관련 함수 ---
function showAlert(title, msg, callback) {
  resetModalState(); 
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalMsg').innerHTML = msg.replace(/\n/g, "<br>");
  document.getElementById('modalBtnCancel').style.display = 'none';
  document.getElementById('modalBtnConfirm').innerText = "확인";
  onModalConfirm = function() { closeModal(); if(callback) callback(); };
  document.getElementById('customModal').style.display = 'flex';
}

function showConfirm(title, msg, yesCallback) {
  resetModalState(); 
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalMsg').innerHTML = msg;
  document.getElementById('modalBtnCancel').style.display = 'block';
  document.getElementById('modalBtnConfirm').innerText = "설정하기";
  onModalConfirm = function() { closeModal(); if(yesCallback) yesCallback(); };
  document.getElementById('customModal').style.display = 'flex';
}

function showSelectionModal(name, ids, callback) {
  resetModalState(); 
  var modalBox = document.getElementById('commonModalBox');
  modalBox.style.width = "60%";
  modalBox.style.maxWidth = "300px"; 
  document.getElementById('modalTitle').innerText = "학번 선택";
  document.getElementById('modalMsg').innerHTML = "동명이인이 있습니다.<br>찾는 학생의 학번을 선택하세요.";
  document.getElementById('modalBtnGroup').style.display = 'none';
  
  var optContainer = document.getElementById('modalOptions');
  optContainer.innerHTML = ""; 
  optContainer.style.display = 'flex';
  ids.forEach(function(id) {
    var btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerText = id;
    btn.onclick = function() { closeModal(); callback(id); };
    optContainer.appendChild(btn);
  });
  document.getElementById('customModal').style.display = 'flex';
}

function resetModalState() {
  var modalBox = document.getElementById('commonModalBox');
  modalBox.style.width = "90%";
  modalBox.style.maxWidth = "380px";
  document.getElementById('modalOptions').style.display = 'none';
  document.getElementById('modalBtnGroup').style.display = 'flex';
  document.getElementById('modalBtnConfirm').onclick = function() { if (onModalConfirm) onModalConfirm(); else closeModal(); };
}

function closeModal() { document.getElementById('customModal').style.display = 'none'; }
// ---------------------------------------------------------

function autoFill(type) {
  if (isAutoFilling) return;
  var inputIds = document.getElementById('inputIds');
  var inputName = document.getElementById('inputName');
  var rawVal = (type === 'id') ? inputIds.value : inputName.value;
  var searchVal = rawVal ? rawVal.replace(/@/g, "").trim() : "";
  if (searchVal === "") return;
  
  var targetInput = (type === 'id') ? inputName : inputIds;
  var btn = document.getElementById('btnStep1');
  if (targetInput.value !== "" && targetInput.value !== "자동 생성중...") return;

  isAutoFilling = true;
  targetInput.classList.add('loading');
  targetInput.value = "자동 생성중..."; 
  btn.disabled = true; btn.innerHTML = "조회 중...";

  var promise;
  if (type === 'id') {
    promise = db.ref('students/' + searchVal).once('value').then(snap => {
       return snap.exists() ? { success: true, result: snap.val().name } : { success: false };
    });
  } else {
    promise = db.ref('students').orderByChild('name').equalTo(searchVal).once('value').then(snap => {
       if (snap.exists()) {
         var count = snap.numChildren();
         if (count === 1) {
           var foundId = Object.keys(snap.val())[0];
           return { success: true, result: foundId };
         } else {
           var ids = Object.keys(snap.val()).sort(); 
           return { success: true, needSelect: true, ids: ids, name: searchVal };
         }
       } else { return { success: false }; }
    });
  }

  promise.then(function(response) {
    targetInput.classList.remove('loading');
    isAutoFilling = false;
    btn.disabled = false; btn.innerHTML = "확인하기";
    
    if (response.success) {
      if (response.needSelect) {
        targetInput.value = ""; 
        showSelectionModal(response.name, response.ids, function(selectedId) {
          targetInput.value = selectedId;
          btn.focus();
        });
      } else {
        targetInput.value = response.result;
        btn.focus(); 
      }
    } else {
      targetInput.value = "";
      targetInput.blur();
    }
  });
}

function processStep1() {
  if (isAutoFilling) return;
  var rawId = document.getElementById('inputIds').value;
  var rawName = document.getElementById('inputName').value;
  if (rawId === "자동 생성중..." || rawName === "자동 생성중...") return;
  if(!rawId || !rawName) { showAlert("입력 오류", "학번과 이름을 모두 입력해주세요."); return; }
  
  var isAdminMode = (rawId.indexOf("@") > -1) || (rawName.indexOf("@") > -1);
  var id = rawId.replace(/@/g, "").trim();
  var name = rawName.replace(/@/g, "").trim();

  if (isAdminMode) {
    currentId = id; currentName = name;
    document.getElementById('btnStep1').innerHTML = "관리자 권한 조회 중...";
    loadScoreAndShow("##ADMIN_FREE_PASS##"); 
    return; 
  }

  var cachedRaw = localStorage.getItem('cached_student_data');
  if (cachedRaw) {
    try {
      var cached = JSON.parse(cachedRaw);
      if (cached.key === id && cached.name === name) {
         currentId = id; currentName = name;
         fetchedStudentData = cached;
         document.getElementById('step1').style.display = 'none';
         if (cached.pw && String(cached.pw).trim() !== "") {
           document.getElementById('step2-login').style.display = 'block';
           document.getElementById('loginPw').focus();
           history.pushState({ step: 'step2-login' }, 'login', '');
         } else {
           document.getElementById('step2-register').style.display = 'block';
           document.getElementById('regPw1').focus();
           history.pushState({ step: 'step2-register' }, 'register', '');
         }
         return; 
      }
    } catch(e) { console.log("캐시 파싱 오류: " + e); }
  }

  var btn = document.getElementById('btnStep1');
  btn.innerHTML = "확인 중..."; btn.disabled = true;
  
  db.ref('students/' + id).once('value').then(function(snapshot) {
    btn.innerHTML = "확인하기"; btn.disabled = false;
    if (snapshot.exists()) {
      var data = snapshot.val();
      if (data.name !== name) {
        showAlert("정보 불일치", "일치하는 학생 정보가 없습니다.<br>학번과 이름을 다시 확인해주세요.");
        return;
      }
      currentId = id; currentName = name;
      data.key = id; 
      localStorage.setItem('cached_student_data', JSON.stringify(data));
      if (serverVersion) {
         localStorage.setItem('cached_version', serverVersion);
         var dateTxt = document.getElementById('lastUpdatedDisplay').innerText.replace("Update: ", "");
         localStorage.setItem('cached_date_str', dateTxt);
      }
      fetchedStudentData = data;
      document.getElementById('step1').style.display = 'none';
      if (data.pw && String(data.pw).trim() !== "") {
        document.getElementById('step2-login').style.display = 'block';
        document.getElementById('loginPw').focus();
        history.pushState({ step: 'step2-login' }, 'login', '');
      } else {
        document.getElementById('step2-register').style.display = 'block';
        document.getElementById('regPw1').focus();
        history.pushState({ step: 'step2-register' }, 'register', '');
      }
    } else {
      showAlert("정보 불일치", "일치하는 학생 정보가 없습니다.<br>학번과 이름을 다시 확인해주세요.");
    }
  });
}

function processRegister() {
  var pw1 = document.getElementById('regPw1').value;
  var pw2 = document.getElementById('regPw2').value;
  if (!pw1 || pw1.length < 4) { showAlert("비밀번호 오류", "비밀번호는 4글자 이상이어야 합니다."); return; }
  if (pw1 !== pw2) { showAlert("비밀번호 오류", "입력한 두 비밀번호가 서로 다릅니다."); return; }
  
  var msg = "비밀번호를 <span style='color:#d93025; font-weight:bold; font-size:18px;'>" + pw1 + "</span> (으)로<br>설정하시겠습니까?";
  showConfirm("비밀번호 설정", msg, function() { 
    db.ref('students/' + currentId).update({ pw: pw1 }).then(function() {
       if(fetchedStudentData) {
          fetchedStudentData.pw = pw1;
          localStorage.setItem('cached_student_data', JSON.stringify(fetchedStudentData));
       }
       showAlert("설정 완료", "비밀번호가 설정되었습니다.<br>성적을 조회합니다.", function() { loadScoreAndShow(pw1); });
    }).catch(function(err) { showAlert("오류", "시스템 오류가 발생했습니다."); });
  });
}

function processLogin() {
  var pw = document.getElementById('loginPw').value;
  if (!pw) { showAlert("입력 오류", "비밀번호를 입력하세요."); return; }
  loadScoreAndShow(pw);
}

function loadScoreAndShow(pw) {
  if (!fetchedStudentData) {
     db.ref('students/' + currentId).once('value').then(function(snap){
        if(snap.exists()) {
           fetchedStudentData = snap.val();
           fetchedStudentData.key = currentId; 
           localStorage.setItem('cached_student_data', JSON.stringify(fetchedStudentData));
           if(serverVersion) localStorage.setItem('cached_version', serverVersion);
           verifyAndRender(pw);
        } else {
           showAlert("오류", "데이터를 찾을 수 없습니다.");
           resetAll();
        }
     });
  } else { verifyAndRender(pw); }
}

function verifyAndRender(pw) {
   var isMaster = (String(pw).trim() === MASTER_PW || String(pw) === "##ADMIN_FREE_PASS##");
   var storedPw = fetchedStudentData.pw ? String(fetchedStudentData.pw).trim() : "";
   var pwMatch = (storedPw === String(pw).trim());

   if (pwMatch || isMaster) {
     document.querySelector('.container').style.maxWidth = '500px';
     document.querySelectorAll('.step-area').forEach(el => el.style.display = 'none');
     document.getElementById('mainTitle').style.display = 'none';
     document.getElementById('step3-result').style.display = 'block';
     
     history.pushState({ step: 'step3' }, 'result', '');
     globalScoreData = fetchedStudentData.scores || [];
     
     var html = '<div class="result-header">';
     html += '<div class="header-text-group"><span style="color:#4285F4">' + currentName + '</span> 학생의 성적표</div>';
     html += '</div>';
     html += '<div id="accordionArea"></div>';
     html += '<button class="btn btn-secondary" onclick="resetAll()">로그아웃</button>';
     
     document.getElementById('step3-result').innerHTML = html;
     renderAccordionTree(globalScoreData, document.getElementById('accordionArea'));
   } else {
     showAlert("조회 실패", "비밀번호가 틀렸습니다.");
     var btn = document.getElementById('btnStep1');
     btn.innerHTML = "확인하기"; btn.disabled = false;
     document.getElementById('step2-login').style.display = 'block';
     document.getElementById('loginPw').value = "";
   }
}

function renderAccordionTree(data, container) {
  if (!data || data.length === 0) {
    container.innerHTML = '<p style="padding:20px; text-align:center;">등록된 성적 데이터가 없습니다.</p>';
    return;
  }
  data.forEach(function(gradeNode) {
    var gradeBtn = createAccordionBtn(gradeNode.name, 'level-1');
    var gradePanel = document.createElement('div');
    gradePanel.className = 'panel';
    
    container.appendChild(gradeBtn);
    container.appendChild(gradePanel);
    gradeBtn.classList.add('active');
    gradePanel.style.maxHeight = "none"; 
    gradeBtn.onclick = function() { togglePanel(this, gradePanel); };

    if(gradeNode.semesters) {
      gradeNode.semesters.forEach(function(semesterNode) {
        var semesterBtn = createAccordionBtn(semesterNode.name, 'level-2');
        var semesterPanel = document.createElement('div');
        gradePanel.appendChild(semesterBtn);
        gradePanel.appendChild(semesterPanel);
        semesterBtn.onclick = function() { togglePanel(this, semesterPanel); };

        if(semesterNode.subjects) {
          semesterNode.subjects.forEach(function(subjectNode) {
             // 등급 정보 찾기
             var gradeText = "";
             if (subjectNode.items) {
               var totalCat = subjectNode.items.find(function(c) { return c.category === "종합"; });
               if (totalCat) {
                 var gradeItem = totalCat.items.find(function(i) { return i.item === "등급"; });
                 if (gradeItem && gradeItem.score && String(gradeItem.score).trim() !== "") {
                    gradeText = gradeItem.score;
                 }
               }
             }
             // 뱃지 스타일 적용 (상세 등급)
             var btnLabel = subjectNode.name;
             if (gradeText) {
                btnLabel += '<span class="grade-badge">' + gradeText + '등급</span>';
             }

             var subjectBtn = createAccordionBtn(btnLabel, 'level-3');
             var subjectPanel = document.createElement('div');
             subjectPanel.className = 'panel';
             
             semesterPanel.appendChild(subjectBtn);
             semesterPanel.appendChild(subjectPanel);
             subjectBtn.onclick = function() { togglePanel(this, subjectPanel); };

             var tableContainer = document.createElement('div');
             tableContainer.className = 'panel-content';
             tableContainer.innerHTML = getTableHTML(subjectNode.items);
             subjectPanel.appendChild(tableContainer);
          });
        }
      });
    }
  });
}

function createAccordionBtn(text, levelClass) {
  var btn = document.createElement('button');
  btn.className = 'accordion-btn ' + levelClass;
  btn.innerHTML = '<span>' + text + '</span><span class="arrow"></span>';
  return btn;
}

function togglePanel(btn, panel) {
  btn.classList.toggle("active");
  if (panel.style.maxHeight && panel.style.maxHeight !== "0px") {
    panel.style.maxHeight = panel.scrollHeight + "px";
    setTimeout(() => { panel.style.maxHeight = "0px"; }, 10);
  } else {
    panel.style.maxHeight = panel.scrollHeight + "px";
    var parent = panel.parentElement;
    while(parent && parent.classList.contains('panel')) {
       parent.style.maxHeight = "none";
       parent = parent.parentElement;
    }
  }
}

function normalizeSubjectName(name) {
  if(!name) return "";
  var n = name.replace(/\s/g, ""); 
  if (n.includes("화법과작문")) return "국어";
  if (n.includes("언어와매체")) return "국어"; 
  if (n.includes("국어")) return "국어";
  if (n.includes("확률과통계")) return "수학";
  if (n.includes("미적분")) return "수학";
  if (n.includes("기하")) return "수학";
  if (n.includes("수학")) return "수학";
  if (n.includes("영어")) return "영어";
  return name;
}

function showTrendGraph(subjectName) {
  var targetSubject = normalizeSubjectName(subjectName);
  if (!['국어', '수학', '영어'].includes(targetSubject)) return;

  var trendData = [];
  if (globalScoreData && globalScoreData.length > 0) {
    globalScoreData.forEach(function(gradeNode) {
      var gradeNum = parseInt(gradeNode.name.replace(/[^0-9]/g, "")) || 0;
      if (!gradeNode.semesters) return;
      gradeNode.semesters.forEach(function(semNode) {
        if (!semNode.subjects) return;
        semNode.subjects.forEach(function(subNode) {
          var monthStr = subNode.name.replace(/[^0-9]/g, ""); 
          var monthNum = parseInt(monthStr);
          if (isNaN(monthNum)) return;
          var gradeCategory = subNode.items.find(function(c) { return c.category === "등급"; });
          
          if (gradeCategory) {
             var scoreItem = gradeCategory.items.find(function(it) {
                return normalizeSubjectName(it.item) === targetSubject;
             });
             if (scoreItem && !isNaN(parseFloat(scoreItem.score))) {
               var score = parseFloat(scoreItem.score);
               var sortKey = gradeNum * 100 + monthNum;
               trendData.push({ grade: gradeNum, month: monthNum, score: score, sortKey: sortKey });
             }
          }
        });
      });
    });
  }

  if (trendData.length === 0) {
    showAlert("알림", targetSubject + " 과목의 모의고사 데이터가 없습니다.");
    return;
  }

  trendData.sort(function(a, b) { return a.sortKey - b.sortKey; });
  var labels = trendData.map(d => d.grade); 
  var scores = trendData.map(d => d.score); 

  document.getElementById('graphTitle').innerText = targetSubject + " 등급 추이";
  document.getElementById('graphModal').style.display = 'flex';

  var ctx = document.getElementById('trendChart').getContext('2d');
  if (myChart) myChart.destroy(); 

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels, 
      datasets: [{
        label: '등급',
        data: scores,
        borderColor: '#4285F4',
        backgroundColor: 'rgba(66, 133, 244, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#4285F4',
        pointRadius: 5,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 10, bottom: 0, left: 0, right: 10 } },
      scales: {
        y: {
          min: 0.5, max: 9, reverse: true,
          ticks: { stepSize: 1, padding: 10, callback: function(val) { if (val < 1 || val === 9) return ""; return Math.floor(val); } },
          grid: { color: '#f0f0f0' }
        },
        x: {
          offset: false, grid: { display: false },
          ticks: {
            callback: function(val, index) {
              var currentGrade = labels[index];
              if (index === 0 || labels[index - 1] !== currentGrade) { return currentGrade + "학년"; }
              return "";
            }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false, 
          callbacks: { title: function() { return ""; }, label: function(context) { var d = trendData[context.dataIndex]; return d.month + "월"; } }
        }
      }
    }
  });
}

function closeGraphModal() { document.getElementById('graphModal').style.display = 'none'; }

// [최종 수정] 클릭 영역을 아이콘으로 한정함
function getTableHTML(categoryList) {
  var isMockExam = categoryList.some(function(c) { return c.category === "등급"; });
  var html = '<table>';
  
  if (isMockExam) { html += '<thead><tr><th>과목</th><th>등급</th></tr></thead>'; }
  html += '<tbody>';
  
  if (categoryList && categoryList.length > 0) {
    for (var k = 0; k < categoryList.length; k++) {
      var category = categoryList[k].category; 
      var items = categoryList[k].items;       
      var categoryScore = ""; 
      var displayItems = []; 
      
      for (var i = 0; i < items.length; i++) {
        var itemName = items[i].item;
        if (category === "종합" && itemName === "등급") { continue; }
        if (itemName.replace(/\s/g, "") === "합계") { categoryScore = items[i].score; } 
        else { displayItems.push(items[i]); }
      }
      if (displayItems.length === 0 && categoryScore === "") { continue; }
      if (isMockExam && category === "등급") { /* 카테고리 행 생략 */ } else {
         var bgClass = 'bg-default';
         if (category.indexOf('고사') > -1 || category.indexOf('시험') > -1) bgClass = 'bg-exam';
         else if (category.indexOf('수행') > -1) bgClass = 'bg-perform';
         html += '<tr class="category-row ' + bgClass + '">';
         html += '  <td>' + category + '</td>';
         html += '  <td style="text-align:center;">' + categoryScore + '</td>'; 
         html += '</tr>';
      }
      
      for (var i = 0; i < displayItems.length; i++) {
        var itemName = displayItems[i].item;
        var itemScore = displayItems[i].score;
        var scoreStyle = "";
        
        var normalized = normalizeSubjectName(itemName);
        var isTarget = ['국어','수학','영어'].includes(normalized);
        var iconHtml = "";

        if (isMockExam && isTarget) {
           // [수정] onclick 이벤트를 td가 아닌 badge로 이동
           iconHtml = '<span class="trend-badge" onclick="showTrendGraph(\'' + itemName + '\')">' +
                      '<svg class="trend-svg" viewBox="0 0 24 24">' +
                        // X, Y축 (L자)
                        '<path d="M4 4 L4 20 L20 20" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
                        // 상승 그래프 (지그재그)
                        '<polyline points="7 16 11 12 15 14 19 8" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
                      '</svg>' +
                      '</span>';
        }
        if (itemName.indexOf("객관식") > -1 || itemName.indexOf("주관식") > -1) {
           scoreStyle = 'style="font-weight: normal; color: #555;"'; 
        }
        
        // [수정] td의 clickable-cell 클래스 제거, onclick 제거
        html += '<tr class="item-row">';
        html += '  <td><span>' + itemName + '</span>' + iconHtml + '</td>';
        html += '  <td ' + scoreStyle + '>' + itemScore + '</td>';
        html += '</tr>';
      }
    }
  } else { html += '<tr><td colspan="2" style="text-align:center; padding: 20px;">결과 없음</td></tr>'; }
  html += '</tbody></table>';
  return html;
}

function resetAll() { location.href = location.href; }

// 서비스 워커 등록
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(() => console.log('서비스 워커 등록 성공'))
    .catch(() => console.log('서비스 워커 등록 실패'));
}