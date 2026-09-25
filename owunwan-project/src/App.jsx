import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase.js";
import { doc, getDoc, runTransaction } from "firebase/firestore";

const WEEKS = [];
for (let i = 0; i < 15; i++) {
  const start = new Date(2026, 8, 27 + i * 7);
  const end = new Date(2026, 8, 27 + i * 7 + 6);
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  WEEKS.push({ key: `week-${String(i + 1).padStart(2, "0")}`, label: `${i + 1}주`, fullLabel: `${i + 1}주차 (${fmt(start)} ~ ${fmt(end)})`, startDate: start, endDate: end });
}

const ADMIN_NAME = "관리자";
const ADMIN_PASSWORD = "admin1234";
const PRAY_ICON = "data:image/png;base64,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";

function hashPassword(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; } return h.toString(36); }
function isWeekActive(w) { if (w.key === "week-01") return new Date() >= new Date(2026, 8, 23); return w.startDate <= new Date(); }
function getDefaultWeek() { const a = WEEKS.filter(isWeekActive); return a.length > 0 ? a[a.length - 1].key : WEEKS[0].key; }

export default function App() {
  // 로그인 상태 복원
  const saved = (() => { try { const s = sessionStorage.getItem("owunwan-user"); return s ? JSON.parse(s) : null; } catch { return null; } })();
  const [view, setView] = useState(saved ? "dashboard" : "home");
  const [currentUser, setCurrentUser] = useState(saved?.type === "user" ? saved : null);
  const [isAdmin, setIsAdmin] = useState(saved?.type === "admin");
  const [selectedWeek, setSelectedWeek] = useState(getDefaultWeek());
  const [prayers, setPrayers] = useState({});
  const [announcements, setAnnouncements] = useState({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [prayerText, setPrayerText] = useState("");
  const [prayerPublic, setPrayerPublic] = useState(true);
  const [editingPrayer, setEditingPrayer] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [announcementText, setAnnouncementText] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [commentTexts, setCommentTexts] = useState({});
  const [editingCommentKey, setEditingCommentKey] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  const showNotification = useCallback((msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 3000); }, []);

  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const allP = {}, allA = {};
    for (const w of WEEKS) {
      try { const s = await getDoc(doc(db, "prayers", w.key)); allP[w.key] = s.exists() ? s.data().items || [] : []; } catch { allP[w.key] = []; }
      try { const s = await getDoc(doc(db, "announcements", w.key)); allA[w.key] = s.exists() ? s.data().text || "" : ""; } catch { allA[w.key] = ""; }
    }
    setPrayers(allP); setAnnouncements(allA); setLoading(false);
  }, []);

  useEffect(() => { loadAllData(); }, [loadAllData]);
  useEffect(() => { if (view !== "prayer") return; const t = setInterval(() => loadAllData(true), 45000); return () => clearInterval(t); }, [view, loadAllData]);

  function doLogin() {
    const name = loginName.trim(), pw = loginPw.trim();
    if (!name || !pw) { showNotification("이름과 비밀번호를 입력해주세요.", "error"); return; }
    if (name !== ADMIN_NAME && (!/^\d{4}$/.test(pw))) { showNotification("비밀번호는 숫자 4자리로 입력해주세요.", "error"); return; }
    if (name === ADMIN_NAME && pw === ADMIN_PASSWORD) {
      setIsAdmin(true); setCurrentUser(null); setView("dashboard"); setLoginName(""); setLoginPw("");
      try { sessionStorage.setItem("owunwan-user", JSON.stringify({ type: "admin" })); } catch {}
      showNotification("관리자로 로그인했습니다."); return;
    }
    const user = { type: "user", name, pw, pwHash: hashPassword(pw) };
    setCurrentUser(user); setIsAdmin(false); setView("dashboard"); setLoginName(""); setLoginPw("");
    try { sessionStorage.setItem("owunwan-user", JSON.stringify(user)); } catch {}
    showNotification(`${name}님, 환영합니다.`);
  }

  function handleLogout() { setCurrentUser(null); setIsAdmin(false); setView("home"); setEditingPrayer(null); setPrayerText(""); setPrayerPublic(true); setEditingAnnouncement(false); try { sessionStorage.removeItem("owunwan-user"); } catch {} }
  function goHome() { setView(currentUser || isAdmin ? "dashboard" : "home"); setEditingPrayer(null); setEditingAnnouncement(false); }

  async function saveAnnouncement() {
    if (submitting) return; setSubmitting(true);
    try { const ref = doc(db, "announcements", selectedWeek); await runTransaction(db, async (tx) => { tx.set(ref, { text: announcementText.trim(), updatedAt: new Date().toISOString() }); }); await loadAllData(true); setEditingAnnouncement(false); showNotification("공통 기도제목이 저장되었습니다."); } catch { showNotification("저장 실패", "error"); } finally { setSubmitting(false); }
  }

  async function doSubmitPrayer() {
    if (!prayerText.trim()) { showNotification("기도제목을 입력해주세요.", "error"); return; }
    if (submitting) return; setSubmitting(true);
    const entry = { name: currentUser.name, pw: currentUser.pw, pwHash: currentUser.pwHash, text: prayerText.trim(), isPublic: prayerPublic, updatedAt: new Date().toISOString() };
    try {
      const ref = doc(db, "prayers", selectedWeek);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref); const cur = snap.exists() ? snap.data().items || [] : [];
        const idx = cur.findIndex((p) => p.name === currentUser.name && p.pwHash === currentUser.pwHash);
        entry.createdAt = idx >= 0 ? cur[idx].createdAt : new Date().toISOString();
        entry.comments = idx >= 0 ? cur[idx].comments || [] : [];
        const upd = idx >= 0 ? cur.map((p, i) => i === idx ? entry : p) : [...cur, entry];
        tx.set(ref, { items: upd });
      });
      await loadAllData(true); setPrayerText(""); setPrayerPublic(true); setEditingPrayer(null); showNotification("기도제목이 저장되었습니다.");
    } catch { showNotification("저장 실패", "error"); } finally { setSubmitting(false); }
  }

  async function handleDeletePrayer(wk, name, pwHash) { try { const ref = doc(db, "prayers", wk); await runTransaction(db, async (tx) => { const s = await tx.get(ref); const c = s.exists() ? s.data().items || [] : []; tx.set(ref, { items: c.filter((p) => !(p.name === name && p.pwHash === pwHash)) }); }); await loadAllData(true); setDeleteConfirm(null); showNotification("삭제되었습니다."); } catch { showNotification("삭제 실패", "error"); } }

  async function handleDeleteUser(name, pwHash) { try { for (const w of WEEKS) { const ref = doc(db, "prayers", w.key); await runTransaction(db, async (tx) => { const s = await tx.get(ref); const c = s.exists() ? s.data().items || [] : []; const f = c.filter((p) => !(p.name === name && p.pwHash === pwHash)); if (f.length !== c.length) tx.set(ref, { items: f }); }); } await loadAllData(true); setDeleteConfirm(null); showNotification(`${name}님의 모든 데이터가 삭제되었습니다.`); } catch { showNotification("삭제 실패", "error"); } }

  async function addComment(pN, pH) { const ck = `${pN}-${pH}`, text = (commentTexts[ck] || "").trim(); if (!text || submitting) return; setSubmitting(true); const cn = isAdmin ? "관리자" : currentUser.name; const cph = isAdmin ? "admin" : currentUser.pwHash; try { const ref = doc(db, "prayers", selectedWeek); await runTransaction(db, async (tx) => { const s = await tx.get(ref); const c = s.exists() ? s.data().items || [] : []; const u = c.map((p) => p.name === pN && p.pwHash === pH ? { ...p, comments: [...(p.comments || []), { name: cn, pwHash: cph, text, createdAt: new Date().toISOString() }] } : p); tx.set(ref, { items: u }); }); await loadAllData(true); setCommentTexts((prev) => ({ ...prev, [ck]: "" })); showNotification("댓글이 등록되었습니다."); } catch { showNotification("댓글 등록 실패", "error"); } finally { setSubmitting(false); } }

  async function editComment(pN, pH, ci, newText) { if (!newText.trim() || submitting) return; setSubmitting(true); try { const ref = doc(db, "prayers", selectedWeek); await runTransaction(db, async (tx) => { const s = await tx.get(ref); const c = s.exists() ? s.data().items || [] : []; const u = c.map((p) => p.name === pN && p.pwHash === pH ? { ...p, comments: (p.comments || []).map((cm, i) => i === ci ? { ...cm, text: newText.trim(), editedAt: new Date().toISOString() } : cm) } : p); tx.set(ref, { items: u }); }); await loadAllData(true); setEditingCommentKey(null); showNotification("댓글이 수정되었습니다."); } catch { showNotification("댓글 수정 실패", "error"); } finally { setSubmitting(false); } }

  async function deleteComment(pN, pH, ci) { try { const ref = doc(db, "prayers", selectedWeek); await runTransaction(db, async (tx) => { const s = await tx.get(ref); const c = s.exists() ? s.data().items || [] : []; const u = c.map((p) => p.name === pN && p.pwHash === pH ? { ...p, comments: (p.comments || []).filter((_, i) => i !== ci) } : p); tx.set(ref, { items: u }); }); await loadAllData(true); showNotification("댓글이 삭제되었습니다."); } catch { showNotification("댓글 삭제 실패", "error"); } }

  function isCommentOwner(comment) { if (isAdmin && comment.pwHash === "admin") return true; return currentUser && comment.pwHash === currentUser.pwHash && comment.name === currentUser.name; }

  function startEdit(p) { setPrayerText(p.text); setPrayerPublic(p.isPublic); setEditingPrayer(p); }
  function canSee(p) { return p.isPublic || isAdmin || (currentUser && p.name === currentUser.name && p.pwHash === currentUser.pwHash); }
  function isOwner(p) { return currentUser && p.name === currentUser.name && p.pwHash === currentUser.pwHash; }

  const weekPrayers = (prayers[selectedWeek] || []).filter(canSee);
  const myPrayer = currentUser ? (prayers[selectedWeek] || []).find((p) => p.name === currentUser.name && p.pwHash === currentUser.pwHash) : null;
  const hasAnyActive = WEEKS.some(isWeekActive);
  const curAnn = announcements[selectedWeek] || "";

  return (
    <div style={S.app}><style>{globalCSS}</style>

      {notification && <div style={{ ...S.notification, background: notification.type === "error" ? "#e74c3c" : "#27ae60", }}>{notification.msg}</div>}

      {deleteConfirm && <div style={S.modalOverlay}><div style={S.modalBox}>
        <p style={S.modalText}>{deleteConfirm.type === "user" ? `"${deleteConfirm.name}"님의 모든 데이터를 삭제할까요?` : `"${deleteConfirm.name}"님의 기도제목을 삭제할까요?`}</p>
        <div style={S.modalBtns}>
          <button type="button" style={S.modalConfirmBtn} onClick={() => { deleteConfirm.type === "user" ? handleDeleteUser(deleteConfirm.name, deleteConfirm.pwHash) : handleDeletePrayer(deleteConfirm.weekKey, deleteConfirm.name, deleteConfirm.pwHash); }}>삭제</button>
          <button type="button" style={S.modalCancelBtn} onClick={() => setDeleteConfirm(null)}>취소</button>
        </div>
      </div></div>}

      <header style={S.header}><div style={S.headerInner}>
        <div style={S.logoArea} onClick={goHome}><img src={PRAY_ICON} alt="홈" style={S.logoImg} /></div>
        {(currentUser || isAdmin) && <div style={S.headerRight}>
          <span style={S.userName}>{isAdmin ? "관리자" : currentUser?.name}</span>
          <button type="button" style={S.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>}
      </div></header>

      <main style={S.main}>
        {view === "home" && <div style={S.homeContainer}>
          <div style={S.heroSection}>
            <img src={PRAY_ICON} alt="오운완" style={S.heroIcon} />
            <p style={S.heroTitle}>오운완</p>
            <p style={S.heroSub}>함께 기도해요</p>
          </div>
          <div style={S.loginCardWrap}><div style={S.loginCard}>
            <h2 style={S.cardTitle}>기도제목 나누기</h2>
            <p style={S.cardDesc}>이름과 비밀번호로 로그인하여 기도제목을 나눠주세요</p>
            <div style={S.formDiv}>
              <input style={S.input} placeholder="이름" value={loginName} onChange={(e) => setLoginName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} />
              <input style={S.input} type="password" placeholder="비밀번호 (숫자 4자리)" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doLogin(); }} />
              <button type="button" style={S.primaryBtn} onClick={doLogin}>로그인</button>
            </div>
            <p style={S.loginHint}>* 처음 오시는 분은 이름과 비밀번호(숫자 4자리)를 설정하시면 됩니다.<br/>* 이후 같은 정보로 로그인하여 기도제목을 수정할 수 있습니다.</p>
          </div></div>
        </div>}

        {view === "dashboard" && <div style={S.dashContainer}>
          <div style={S.dashHero}>
            <img src={PRAY_ICON} alt="" style={S.dashIcon} />
            <p style={S.dashWelcome}>{isAdmin ? "관리자" : currentUser?.name}님,</p>
            <p style={S.dashStatus}>로그인이 되어있습니다</p>
          </div>
          <div style={S.dashActions}>
            <button type="button" style={S.dashBtn} onClick={() => { setView("prayer"); loadAllData(true); }}>
              <span style={S.dashBtnIcon}>📖</span>
              <span style={S.dashBtnText}>기도작성 페이지로 이동</span>
              <span style={S.dashBtnArrow}>→</span>
            </button>
          </div>
        </div>}

        {view === "prayer" && <div style={S.prayerContainer}>
          {!hasAnyActive && <div style={S.noActive}><p>2026년 9월 27일부터 시작됩니다.</p></div>}
          <div style={S.weekTabs}>
            {WEEKS.map((w) => { const ac = isWeekActive(w), sel = selectedWeek === w.key; return (
              <button key={w.key} type="button" disabled={!ac}
                onClick={() => { if (ac) { setSelectedWeek(w.key); setEditingPrayer(null); setPrayerText(""); setPrayerPublic(true); setEditingAnnouncement(false); loadAllData(true); } }}
                style={{ ...S.weekTab, ...(sel && ac ? S.weekTabSel : {}), ...(!ac ? S.weekTabOff : {}) }}>{w.label}</button>
            ); })}
          </div>
          {hasAnyActive && <>
            <h2 style={S.weekTitle}>{WEEKS.find((w) => w.key === selectedWeek)?.fullLabel}</h2>

            <div style={S.annSection}>
              <h3 style={S.secTitle}>📌 공통 기도제목</h3>
              {isAdmin && !editingAnnouncement && <button type="button" style={S.editBtn} onClick={() => { setAnnouncementText(curAnn); setEditingAnnouncement(true); }}>{curAnn ? "수정" : "작성"}</button>}
              {isAdmin && editingAnnouncement ? <div style={S.formDiv}>
                <textarea style={S.textarea} placeholder="공통 기도제목을 작성해주세요..." value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} rows={3} />
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }} onClick={saveAnnouncement} disabled={submitting}>{submitting ? "저장 중..." : "저장"}</button>
                  <button type="button" style={S.cancelBtn} onClick={() => setEditingAnnouncement(false)}>취소</button>
                </div>
              </div> : curAnn ? <p style={S.annText}>{curAnn}</p> : <p style={S.annEmpty}>아직 공통 기도제목이 없습니다.</p>}
            </div>

            {currentUser && !myPrayer && !editingPrayer && <div style={S.writeSection}>
              <h3 style={S.secTitle}>기도제목 작성</h3>
              <div style={S.formDiv}>
                <textarea style={S.textarea} placeholder="기도제목을 작성해주세요..." value={prayerText} onChange={(e) => setPrayerText(e.target.value)} rows={4} />
                <div style={S.visRow}>
                  <span style={S.visLabel}>공개 설정:</span>
                  <button type="button" onClick={() => setPrayerPublic(true)} style={{ ...S.visBtn, ...(prayerPublic ? S.visBtnOn : {}) }}>🌐 공개</button>
                  <button type="button" onClick={() => setPrayerPublic(false)} style={{ ...S.visBtn, ...(!prayerPublic ? S.visBtnOff : {}) }}>🔒 비공개</button>
                </div>
                <p style={S.visHint}>{prayerPublic ? "모든 사람이 볼 수 있습니다." : "관리자만 볼 수 있습니다."}</p>
                <button type="button" style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }} onClick={doSubmitPrayer} disabled={submitting}>{submitting ? "저장 중..." : "기도제목 등록"}</button>
              </div>
            </div>}

            {currentUser && editingPrayer && <div style={S.writeSection}>
              <h3 style={S.secTitle}>기도제목 수정</h3>
              <div style={S.formDiv}>
                <textarea style={S.textarea} value={prayerText} onChange={(e) => setPrayerText(e.target.value)} rows={4} />
                <div style={S.visRow}>
                  <span style={S.visLabel}>공개 설정:</span>
                  <button type="button" onClick={() => setPrayerPublic(true)} style={{ ...S.visBtn, ...(prayerPublic ? S.visBtnOn : {}) }}>🌐 공개</button>
                  <button type="button" onClick={() => setPrayerPublic(false)} style={{ ...S.visBtn, ...(!prayerPublic ? S.visBtnOff : {}) }}>🔒 비공개</button>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" style={{ ...S.primaryBtn, opacity: submitting ? 0.5 : 1 }} onClick={doSubmitPrayer} disabled={submitting}>{submitting ? "저장 중..." : "수정 완료"}</button>
                  <button type="button" style={S.cancelBtn} onClick={() => { setEditingPrayer(null); setPrayerText(""); setPrayerPublic(true); }}>취소</button>
                </div>
              </div>
            </div>}

            {currentUser && myPrayer && !editingPrayer && <div style={S.myBanner}>
              <p style={S.myLabel}>✓ 이번 주 기도제목이 등록되어 있습니다</p>
              <button type="button" style={S.editBtn} onClick={() => startEdit(myPrayer)}>수정하기</button>
            </div>}

            <div style={S.prayerList}>
              <h3 style={S.secTitle}>기도제목 목록 <span style={S.badge}>{weekPrayers.length}</span></h3>
              {loading ? <div style={S.empty}>불러오는 중...</div>
              : weekPrayers.length === 0 ? <div style={S.empty}>아직 등록된 기도제목이 없습니다.</div>
              : weekPrayers.map((pr, idx) => { const ck = `${pr.name}-${pr.pwHash}`; return (
                <div key={idx} style={S.card}>
                  <div style={S.cardHead}>
                    <div style={S.cardNameRow}>
                      <div style={S.avatar}>{pr.name.charAt(0)}</div>
                      <span style={S.cardName}>{pr.name}</span>
                      <span style={{ ...S.visBadge, background: pr.isPublic ? "#e8f5e9" : "#fce4ec", color: pr.isPublic ? "#388e3c" : "#c62828" }}>{pr.isPublic ? "공개" : "비공개"}</span>
                    </div>
                    {(isOwner(pr) || isAdmin) && <div style={S.cardActions}>
                      {isOwner(pr) && <button type="button" style={S.actBtn} onClick={() => startEdit(pr)}>수정</button>}
                      <button type="button" style={{ ...S.actBtn, color: "#e53935" }} onClick={() => setDeleteConfirm({ type: "prayer", weekKey: selectedWeek, name: pr.name, pwHash: pr.pwHash })}>삭제</button>
                    </div>}
                  </div>
                  <p style={S.cardText}>{pr.text}</p>
                  <p style={S.cardDate}>{new Date(pr.updatedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</p>
                  <div style={S.cmtSection}>
                    {(pr.comments || []).length > 0 && <div style={S.cmtList}>
                      {(pr.comments || []).map((c, ci) => { const cmtKey = `${pr.name}-${pr.pwHash}-${ci}`; return <div key={ci} style={S.cmtItem}>
                        <div style={S.cmtTop}>
                          <span style={S.cmtName}>{c.name}</span>
                          <span style={S.cmtDate}>{new Date(c.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}{c.editedAt ? " (수정됨)" : ""}</span>
                          {(isCommentOwner(c) || isAdmin) && editingCommentKey !== cmtKey && <>
                            {isCommentOwner(c) && <button type="button" style={{ ...S.actBtn, fontSize: "11px" }} onClick={() => { setEditingCommentKey(cmtKey); setEditingCommentText(c.text); }}>수정</button>}
                            <button type="button" style={{ ...S.actBtn, color: "#e53935", fontSize: "11px" }} onClick={() => deleteComment(pr.name, pr.pwHash, ci)}>삭제</button>
                          </>}
                        </div>
                        {editingCommentKey === cmtKey ? (
                          <div style={S.cmtEditRow}>
                            <input style={S.cmtInput} value={editingCommentText} onChange={(e) => setEditingCommentText(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") editComment(pr.name, pr.pwHash, ci, editingCommentText); }} />
                            <button type="button" style={S.cmtBtn} onClick={() => editComment(pr.name, pr.pwHash, ci, editingCommentText)} disabled={submitting}>저장</button>
                            <button type="button" style={{ ...S.actBtn, fontSize: "12px" }} onClick={() => setEditingCommentKey(null)}>취소</button>
                          </div>
                        ) : (
                          <p style={S.cmtText}>{c.text}</p>
                        )}
                      </div>; })}
                    </div>}
                    {(currentUser || isAdmin) && <div style={S.cmtInputRow}>
                      <input style={S.cmtInput} placeholder="댓글을 입력하세요..." value={commentTexts[ck] || ""}
                        onChange={(e) => setCommentTexts((prev) => ({ ...prev, [ck]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") addComment(pr.name, pr.pwHash); }} />
                      <button type="button" style={S.cmtBtn} onClick={() => addComment(pr.name, pr.pwHash)} disabled={submitting}>등록</button>
                    </div>}
                  </div>
                </div>
              ); })}
            </div>

            {currentUser && <div style={S.histSection}>
              <h3 style={S.secTitle}>나의 기도제목 기록</h3>
              <div style={S.histGrid}>{WEEKS.filter(isWeekActive).map((w) => {
                const mp = (prayers[w.key] || []).find((p) => p.name === currentUser.name && p.pwHash === currentUser.pwHash);
                return <div key={w.key} style={{ ...S.histCard, borderLeft: mp ? "3px solid #66bb6a" : "3px solid #e0e0e0" }}>
                  <span style={S.histWeek}>{w.fullLabel}</span>
                  {mp ? <p style={S.histText}>{mp.text}</p> : <p style={S.histEmpty}>미등록</p>}
                </div>;
              })}</div>
            </div>}

            {isAdmin && <div style={S.histSection}>
              <h3 style={S.secTitle}>📊 이번 주 참여 현황</h3>
              <div style={S.participationWrap}>{(() => {
                const um = {}; WEEKS.forEach((w) => (prayers[w.key] || []).forEach((p) => { if (p.pw) um[p.name + "|" + p.pwHash] = { name: p.name, pwHash: p.pwHash }; }));
                const allUsers = Object.values(um);
                const thisWeek = prayers[selectedWeek] || [];
                if (allUsers.length === 0) return <p style={S.histEmpty}>아직 등록된 사용자가 없습니다.</p>;
                const wrote = allUsers.filter(u => thisWeek.some(p => p.name === u.name && p.pwHash === u.pwHash));
                const notWrote = allUsers.filter(u => !thisWeek.some(p => p.name === u.name && p.pwHash === u.pwHash));
                return <>
                  <div style={S.participationSummary}>
                    <span style={S.participationDone}>참여 {wrote.length}명</span>
                    <span style={S.participationBar}><span style={{...S.participationFill, width: `${allUsers.length > 0 ? (wrote.length / allUsers.length * 100) : 0}%`}} /></span>
                    <span style={S.participationTotal}>{allUsers.length}명 중</span>
                  </div>
                  {wrote.length > 0 && <div style={S.participationGroup}>
                    <p style={S.participationLabel}>✅ 작성 완료</p>
                    <div style={S.participationNames}>{wrote.map((u, i) => <span key={i} style={S.participationChipDone}>{u.name}</span>)}</div>
                  </div>}
                  {notWrote.length > 0 && <div style={S.participationGroup}>
                    <p style={S.participationLabel}>⏳ 미작성</p>
                    <div style={S.participationNames}>{notWrote.map((u, i) => <span key={i} style={S.participationChipPending}>{u.name}</span>)}</div>
                  </div>}
                </>;
              })()}</div>
            </div>}

            {isAdmin && <div style={S.histSection}>
              <h3 style={S.secTitle}>🏆 전체 참여 순위 (15주 누적)</h3>
              <div style={S.leaderboardWrap}>{(() => {
                const um = {}; WEEKS.forEach((w) => (prayers[w.key] || []).forEach((p) => {
                  if (p.pw) {
                    const k = p.name + "|" + p.pwHash;
                    if (!um[k]) um[k] = { name: p.name, count: 0 };
                    um[k].count++;
                  }
                }));
                const ranked = Object.values(um).sort((a, b) => b.count - a.count);
                const activeWeeks = WEEKS.filter(isWeekActive).length;
                if (ranked.length === 0) return <p style={S.histEmpty}>아직 등록된 사용자가 없습니다.</p>;
                return ranked.map((u, i) => (
                  <div key={i} style={S.leaderRow}>
                    <div style={S.leaderRank}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={S.leaderRankNum}>{i + 1}</span>}
                    </div>
                    <span style={S.leaderName}>{u.name}</span>
                    <div style={S.leaderBarWrap}>
                      <div style={{...S.leaderBarFill, width: `${(u.count / activeWeeks) * 100}%`}} />
                    </div>
                    <span style={S.leaderCount}>{u.count}/{activeWeeks}주</span>
                  </div>
                ));
              })()}</div>
            </div>}

            {isAdmin && <div style={S.histSection}>
              <h3 style={S.secTitle}>💬 댓글 활동 순위</h3>
              <div style={S.leaderboardWrap}>{(() => {
                const cm = {};
                WEEKS.forEach((w) => (prayers[w.key] || []).forEach((p) => {
                  (p.comments || []).forEach((c) => {
                    const k = c.name + (c.pwHash || "");
                    if (!cm[k]) cm[k] = { name: c.name, count: 0, chars: 0 };
                    cm[k].count++;
                    cm[k].chars += (c.text || "").length;
                  });
                }));
                const ranked = Object.values(cm).sort((a, b) => b.count - a.count);
                if (ranked.length === 0) return <p style={S.histEmpty}>아직 댓글이 없습니다.</p>;
                const maxCount = ranked[0].count;
                return ranked.map((u, i) => (
                  <div key={i} style={S.leaderRow}>
                    <div style={S.leaderRank}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : <span style={S.leaderRankNum}>{i + 1}</span>}
                    </div>
                    <span style={S.leaderName}>{u.name}</span>
                    <div style={S.leaderBarWrap}>
                      <div style={{...S.leaderBarFill, background: "linear-gradient(90deg, #5c9ce6, #7ab4f5)", width: `${(u.count / maxCount) * 100}%`}} />
                    </div>
                    <span style={{ ...S.leaderCount, color: "#5c9ce6" }}>{u.count}개 · {u.chars}자</span>
                  </div>
                ));
              })()}</div>
            </div>}

            {isAdmin && <div style={S.histSection}>
              <h3 style={S.secTitle}>👤 등록된 사용자 목록</h3>
              <div style={S.userList}>{(() => {
                const um = {}; WEEKS.forEach((w) => (prayers[w.key] || []).forEach((p) => { if (p.pw) um[p.name + "|" + p.pwHash] = { name: p.name, pw: p.pw, pwHash: p.pwHash }; }));
                const users = Object.values(um);
                if (users.length === 0) return <p style={S.histEmpty}>아직 등록된 사용자가 없습니다.</p>;
                return users.map((u, i) => <div key={i} style={S.userRow}>
                  <div style={S.userInfo}><span style={S.userN}>{u.name}</span><span style={S.userP}>{u.pw}</span></div>
                  <button type="button" style={{ ...S.actBtn, color: "#e53935" }} onClick={() => setDeleteConfirm({ type: "user", name: u.name, pwHash: u.pwHash })}>삭제</button>
                </div>);
              })()}</div>
            </div>}
          </>}
        </div>}
      </main>
      <footer style={S.footer}><p style={S.footerText}>오운완 © 2026</p><p style={S.footerCredit}>made by 공정한 사다리 연구소</p></footer>
    </div>
  );
}

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Black+Han+Sans&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #faf7f3; }
  input, textarea, button { font-family: 'Noto Sans KR', sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
  button:hover { opacity: 0.85; }
  input:focus, textarea:focus { border-color: #c9a96e !important; outline: none; }
`;

const S = {
  app: { fontFamily: "'Noto Sans KR', sans-serif", background: "#faf7f3", color: "#3e3a36", minHeight: "100vh", display: "flex", flexDirection: "column" },
  notification: { position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", padding: "12px 28px", borderRadius: "20px", fontSize: "14px", zIndex: 1000, animation: "slideDown 0.3s ease", color: "#fff", maxWidth: "90vw", textAlign: "center", fontWeight: 500 },
  header: { borderBottom: "1px solid rgba(0,0,0,0.06)", position: "sticky", top: 0, zIndex: 100, background: "rgba(250,247,243,0.95)", backdropFilter: "blur(10px)" },
  headerInner: { maxWidth: "1100px", margin: "0 auto", padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  logoArea: { cursor: "pointer", display: "flex", alignItems: "center" },
  logoImg: { width: "40px", height: "40px", objectFit: "contain" },
  headerRight: { display: "flex", alignItems: "center", gap: "14px" },
  userName: { fontSize: "14px", color: "#8a7e72", fontWeight: 400 },
  logoutBtn: { background: "none", border: "1px solid #d5cdc4", color: "#8a7e72", padding: "6px 16px", borderRadius: "20px", cursor: "pointer", fontSize: "13px" },
  main: { flex: 1, maxWidth: "1100px", margin: "0 auto", width: "100%", padding: "0 24px" },
  homeContainer: { animation: "fadeIn 0.6s ease" },
  heroSection: { textAlign: "center", padding: "60px 20px 30px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" },
  heroIcon: { width: "120px", height: "120px", objectFit: "contain", marginBottom: "8px" },
  heroTitle: { fontFamily: "'Black Han Sans', sans-serif", fontSize: "clamp(40px, 10vw, 60px)", color: "#3e3a36", letterSpacing: "4px", lineHeight: 1.1 },
  heroSub: { fontSize: "clamp(16px, 3vw, 20px)", fontWeight: 300, color: "#a89a8c", letterSpacing: "2px" },
  loginCardWrap: { maxWidth: "420px", margin: "30px auto 80px" },
  loginCard: { background: "#fff", border: "1px solid #ece6df", borderRadius: "16px", padding: "32px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" },
  cardTitle: { fontSize: "17px", fontWeight: 600, marginBottom: "6px", color: "#3e3a36" },
  cardDesc: { fontSize: "13px", color: "#a89a8c", marginBottom: "24px", lineHeight: 1.6 },
  formDiv: { display: "flex", flexDirection: "column", gap: "12px" },
  input: { background: "#f7f3ee", border: "1px solid #e8e0d8", borderRadius: "10px", padding: "12px 16px", color: "#3e3a36", fontSize: "14px", outline: "none", width: "100%" },
  textarea: { background: "#f7f3ee", border: "1px solid #e8e0d8", borderRadius: "10px", padding: "14px 16px", color: "#3e3a36", fontSize: "14px", outline: "none", resize: "vertical", lineHeight: 1.7, minHeight: "100px", width: "100%" },
  primaryBtn: { background: "#c9a96e", border: "none", color: "#fff", padding: "12px 24px", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 600, letterSpacing: "0.5px" },
  cancelBtn: { background: "#f0ebe5", border: "none", color: "#8a7e72", padding: "12px 24px", borderRadius: "10px", cursor: "pointer", fontSize: "14px" },
  loginHint: { fontSize: "12px", color: "#b8ad9f", lineHeight: 1.8, marginTop: "12px" },
  dashContainer: { animation: "fadeIn 0.6s ease", padding: "60px 0 80px" },
  dashHero: { textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", marginBottom: "48px" },
  dashIcon: { width: "80px", height: "80px", objectFit: "contain" },
  dashWelcome: { fontSize: "clamp(22px, 5vw, 30px)", fontWeight: 600, color: "#3e3a36" },
  dashStatus: { fontSize: "15px", color: "#a89a8c", fontWeight: 300 },
  dashActions: { maxWidth: "420px", margin: "0 auto" },
  dashBtn: { display: "flex", alignItems: "center", width: "100%", background: "#fff", border: "1px solid #ece6df", borderRadius: "14px", padding: "20px 24px", cursor: "pointer", gap: "16px", fontFamily: "'Noto Sans KR', sans-serif", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" },
  dashBtnIcon: { fontSize: "28px", flexShrink: 0 },
  dashBtnText: { fontSize: "16px", fontWeight: 500, color: "#3e3a36", flex: 1, textAlign: "left" },
  dashBtnArrow: { fontSize: "20px", color: "#c9a96e", flexShrink: 0 },
  prayerContainer: { padding: "30px 0 80px", animation: "fadeIn 0.5s ease" },
  noActive: { textAlign: "center", padding: "60px 20px", color: "#a89a8c", fontSize: "16px" },
  weekTabs: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "28px", justifyContent: "center" },
  weekTab: { background: "#fff", border: "1px solid #e8e0d8", color: "#a89a8c", padding: "8px 16px", borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif" },
  weekTabSel: { background: "#c9a96e", borderColor: "#c9a96e", color: "#fff", fontWeight: 600 },
  weekTabOff: { opacity: 0.3, cursor: "not-allowed", background: "#f5f0eb" },
  weekTitle: { textAlign: "center", fontSize: "18px", fontWeight: 400, marginBottom: "32px", color: "#6b6158" },
  annSection: { background: "#fff8ee", border: "1px solid #f0e4d0", borderLeft: "3px solid #c9a96e", borderRadius: "12px", padding: "20px 24px", marginBottom: "28px" },
  annText: { fontSize: "14px", lineHeight: 1.8, color: "#5a5248", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  annEmpty: { fontSize: "13px", color: "#c4b8aa", fontStyle: "italic" },
  writeSection: { background: "#fff", border: "1px solid #ece6df", borderRadius: "14px", padding: "24px", marginBottom: "28px", boxShadow: "0 1px 6px rgba(0,0,0,0.03)" },
  secTitle: { fontSize: "15px", fontWeight: 600, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px", color: "#4a443e" },
  visRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  visLabel: { fontSize: "13px", color: "#a89a8c" },
  visBtn: { background: "#f5f0eb", border: "1px solid #e8e0d8", color: "#a89a8c", padding: "8px 16px", borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif" },
  visBtnOn: { background: "#e8f5e9", borderColor: "#a5d6a7", color: "#388e3c" },
  visBtnOff: { background: "#fce4ec", borderColor: "#ef9a9a", color: "#c62828" },
  visHint: { fontSize: "12px", color: "#b8ad9f" },
  myBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0faf0", border: "1px solid #c8e6c9", borderRadius: "12px", padding: "14px 20px", marginBottom: "28px", flexWrap: "wrap", gap: "12px" },
  myLabel: { fontSize: "14px", color: "#388e3c" },
  editBtn: { background: "#f5f0eb", border: "1px solid #e0d8d0", color: "#6b6158", padding: "6px 16px", borderRadius: "20px", cursor: "pointer", fontSize: "13px", fontFamily: "'Noto Sans KR', sans-serif" },
  prayerList: { marginBottom: "40px" },
  badge: { fontSize: "12px", background: "#c9a96e", padding: "2px 10px", borderRadius: "12px", color: "#fff", fontWeight: 500 },
  empty: { textAlign: "center", padding: "50px 20px", color: "#c4b8aa", fontSize: "14px" },
  card: { background: "#fff", border: "1px solid #ece6df", borderRadius: "14px", padding: "22px", marginBottom: "12px", boxShadow: "0 1px 6px rgba(0,0,0,0.03)" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" },
  cardNameRow: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: { width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg, #f5e6d0, #e8d5bc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 600, color: "#7a6e60", flexShrink: 0 },
  cardName: { fontSize: "15px", fontWeight: 600, color: "#3e3a36" },
  visBadge: { fontSize: "11px", padding: "2px 10px", borderRadius: "10px", fontWeight: 500 },
  cardActions: { display: "flex", gap: "6px" },
  actBtn: { background: "none", border: "none", color: "#a89a8c", cursor: "pointer", fontSize: "12px", padding: "4px 8px", fontFamily: "'Noto Sans KR', sans-serif" },
  cardText: { fontSize: "14px", lineHeight: 1.8, color: "#5a5248", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  cardDate: { fontSize: "12px", color: "#c4b8aa", marginTop: "12px" },
  cmtSection: { marginTop: "14px", borderTop: "1px solid #f0ebe5", paddingTop: "12px" },
  cmtList: { marginBottom: "10px" },
  cmtItem: { padding: "8px 0", borderBottom: "1px solid #f5f0eb" },
  cmtTop: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" },
  cmtName: { fontSize: "12px", fontWeight: 600, color: "#7a6e60" },
  cmtDate: { fontSize: "11px", color: "#c4b8aa" },
  cmtText: { fontSize: "13px", lineHeight: 1.6, color: "#6b6158" },
  cmtInputRow: { display: "flex", gap: "8px", alignItems: "center" },
  cmtEditRow: { display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" },
  cmtInput: { flex: 1, background: "#f7f3ee", border: "1px solid #e8e0d8", borderRadius: "20px", padding: "8px 14px", color: "#3e3a36", fontSize: "13px", outline: "none" },
  cmtBtn: { background: "#c9a96e", border: "none", color: "#fff", padding: "8px 18px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "'Noto Sans KR', sans-serif", flexShrink: 0 },
  histSection: { borderTop: "1px solid #ece6df", paddingTop: "32px", marginBottom: "32px" },
  histGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" },
  histCard: { background: "#fff", padding: "14px 18px", borderRadius: "10px", border: "1px solid #ece6df" },
  histWeek: { fontSize: "13px", fontWeight: 500, color: "#a89a8c", display: "block", marginBottom: "6px" },
  histText: { fontSize: "13px", lineHeight: 1.7, color: "#5a5248", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  histEmpty: { fontSize: "13px", color: "#d5cdc4", fontStyle: "italic" },
  userList: { display: "flex", flexDirection: "column", gap: "8px" },
  userRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #ece6df", borderRadius: "10px", padding: "12px 16px", gap: "12px" },
  userInfo: { display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", flex: 1 },
  userN: { fontSize: "14px", fontWeight: 600, color: "#3e3a36" },
  userP: { fontSize: "13px", color: "#b8ad9f", fontFamily: "monospace" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(4px)" },
  modalBox: { background: "#fff", borderRadius: "16px", padding: "32px", maxWidth: "360px", width: "90%", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" },
  modalText: { fontSize: "15px", color: "#3e3a36", lineHeight: 1.7, marginBottom: "24px" },
  modalBtns: { display: "flex", gap: "12px", justifyContent: "center" },
  modalConfirmBtn: { background: "#e53935", border: "none", color: "#fff", padding: "10px 24px", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 600, fontFamily: "'Noto Sans KR', sans-serif" },
  modalCancelBtn: { background: "#f0ebe5", border: "none", color: "#6b6158", padding: "10px 24px", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontFamily: "'Noto Sans KR', sans-serif" },
  footer: { borderTop: "1px solid #ece6df", padding: "20px", textAlign: "center", marginTop: "auto" },
  footerText: { fontSize: "12px", color: "#c4b8aa", letterSpacing: "1px" },
  footerCredit: { fontSize: "10px", color: "#d5cdc4", marginTop: "6px", letterSpacing: "0.5px" },
  participationWrap: { display: "flex", flexDirection: "column", gap: "16px" },
  participationSummary: { display: "flex", alignItems: "center", gap: "12px" },
  participationDone: { fontSize: "14px", fontWeight: 600, color: "#388e3c", whiteSpace: "nowrap" },
  participationBar: { flex: 1, height: "8px", background: "#ece6df", borderRadius: "4px", overflow: "hidden" },
  participationFill: { display: "block", height: "100%", background: "linear-gradient(90deg, #66bb6a, #43a047)", borderRadius: "4px", transition: "width 0.5s ease" },
  participationTotal: { fontSize: "13px", color: "#a89a8c", whiteSpace: "nowrap" },
  participationGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  participationLabel: { fontSize: "13px", fontWeight: 500, color: "#6b6158" },
  participationNames: { display: "flex", flexWrap: "wrap", gap: "6px" },
  participationChipDone: { background: "#e8f5e9", color: "#2e7d32", padding: "4px 12px", borderRadius: "14px", fontSize: "13px", fontWeight: 500 },
  participationChipPending: { background: "#fff3e0", color: "#e65100", padding: "4px 12px", borderRadius: "14px", fontSize: "13px", fontWeight: 500 },
  leaderboardWrap: { display: "flex", flexDirection: "column", gap: "8px" },
  leaderRow: { display: "flex", alignItems: "center", gap: "12px", background: "#fff", border: "1px solid #ece6df", borderRadius: "10px", padding: "12px 16px" },
  leaderRank: { fontSize: "20px", width: "32px", textAlign: "center", flexShrink: 0 },
  leaderRankNum: { fontSize: "14px", fontWeight: 600, color: "#a89a8c" },
  leaderName: { fontSize: "14px", fontWeight: 600, color: "#3e3a36", minWidth: "60px", flexShrink: 0 },
  leaderBarWrap: { flex: 1, height: "8px", background: "#f0ebe5", borderRadius: "4px", overflow: "hidden" },
  leaderBarFill: { height: "100%", background: "linear-gradient(90deg, #c9a96e, #d4b87a)", borderRadius: "4px", transition: "width 0.5s ease", minWidth: "4px" },
  leaderCount: { fontSize: "13px", fontWeight: 600, color: "#c9a96e", whiteSpace: "nowrap", flexShrink: 0 },
};
