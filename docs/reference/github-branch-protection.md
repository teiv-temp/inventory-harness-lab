# GitHub 브랜치 보호 설정 참고

> GitHub 저장소 설정 화면에서 제공하는 브랜치 보호 항목을 정리한 참고 문서다. 이 문서는 특정 프로젝트의 운영 규칙이나 CI 절차를 정의하지 않는다.

## 설정 위치

GitHub 저장소에서 다음 경로로 이동한다.

```text
Settings → Rules → Rulesets
```

또는 저장소에서 제공되는 경우:

```text
Settings → Branches → Branch protection rules
```

## 주요 보호 옵션

### Require a pull request before merging

직접 브랜치에 push하지 않고 Pull Request를 통해서만 병합하도록 한다.

### Required approvals

병합 전에 필요한 승인 리뷰 수를 지정한다.

### Dismiss stale pull request approvals when new commits are pushed

승인 이후 새 커밋이 push되면 기존 승인을 무효화한다. 변경된 내용을 다시 검토하도록 한다.

### Require approval of the most recent push

가장 최근 push에 대한 별도의 승인을 요구한다.

### Require status checks to pass before merging

지정한 상태 검사(status check)가 성공해야 병합할 수 있도록 한다.

### Require branches to be up to date before merging

병합 전에 대상 브랜치의 최신 변경사항을 작업 브랜치에 반영하도록 요구한다.

### Require conversation resolution before merging

Pull Request의 검토 대화가 해결된 뒤에만 병합하도록 한다.

### Block force pushes

보호 브랜치에 대한 강제 push를 막는다.

### Restrict deletions

보호 브랜치의 삭제를 막는다.

### Include administrators

관리자에게도 해당 보호 규칙을 적용할지 선택한다. 비상 우회가 필요한 운영 정책이 있다면 별도로 결정해야 한다.

## 적용 시 확인할 항목

- 보호할 브랜치 패턴
- Pull Request 필수 여부
- 필요한 승인 수
- 새 커밋 push 이후 재승인 여부
- 필수 status check 목록
- 최신 브랜치 반영 요구 여부
- 대화 해결 요구 여부
- force push·브랜치 삭제 제한 여부
- 관리자 예외 허용 여부
