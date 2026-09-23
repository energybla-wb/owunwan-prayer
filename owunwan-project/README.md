# 오운완 - 기도제목 나눔 앱

## 배포 방법 (나비워십 때와 동일하지만 새 프로젝트로!)

### 1. 새 Firebase 프로젝트 만들기
- https://console.firebase.google.com 에서 **새 프로젝트** 추가
- 프로젝트 이름: `owunwan-prayer`
- Firestore Database 만들기 (서울, 테스트 모드)
- 웹 앱 등록 → firebaseConfig 값 복사
- `src/firebase.js`에 값 붙여넣기

### 2. Firestore 보안 규칙 (테스트 모드 만료 전에 꼭!)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /prayers/{monthKey} {
      allow read, write: if true;
    }
    match /announcements/{monthKey} {
      allow read, write: if true;
    }
  }
}
```

### 3. GitHub 저장소 + Vercel 배포
- GitHub에 `owunwan-prayer` 저장소 생성
- git push
- Vercel에서 Import → Deploy

### 4. 수정 후 재배포
```
git add .
git commit -m "수정 내용"
git push
```

## 관리자 로그인
- 이름: `관리자`
- 비밀번호: `admin1234`
