---
name: test-design
description: 単体テスト・統合テスト・ブラウザテストの設計、追加、修正、レビューに使う。Arrange・Act・Assert（AAA）で整理し、仕様から検証ケースを選び、回帰検出力と安定性を確認する。
---

# テスト設計と AAA

## 設計・レビューで確認すること

1. **仕様とケースが対応しているか。** テスト名に振る舞いと結果を書く。変更の影響がある正常系、境界、失敗・拒否から、異なる不具合を検出するケースを選ぶ。同じ操作で選択値とフォーカスが維持される場合は、両方を一つのテストで確認してよい。
2. **実際の利用経路と結果を検証しているか。** 公開 API や利用者の操作を通し、返り値、保存状態、画面、アクセシブルな名前、フォーカスなどを検証する。UI の操作対象は役割と名前で探せる場合はそれを使う。コールバックが契約なら必要な引数や回数も確認する。CSS の計算値や位置が仕様なら実ブラウザで測る。
3. **意図した破損で失敗するか。** 初期値が期待値と同じ、対象が最初から存在しない、モックが期待結果を作り切っている、といった条件で誤って通らないか確認する。回帰テストは、可能なら修正前に意図したアサーションで失敗し、修正後に通ることを確かめる。単なる例外や環境エラーによる失敗は再現確認に含めない。
4. **単独実行でも結果が安定するか。** テストごとにデータとモックを用意し、共有状態や実行順に依存しない。モックはネットワークや時計など制御が必要な境界に置く。非同期では固定時間で待たず、UI の表示や Promise の完了など検証対象の状態を待つ。

## AAA の書き方

- **Arrange（準備）** でデータ、モック、描画、操作対象を用意する。操作前の状態が再現条件なら、その状態を確認する。
- **Act（操作）** で対象を呼び出すか、利用者と同じ操作を行う。
- **Assert（検証）** で期待する結果を明示する。前提が崩れたときはアサーションで失敗させ、実行時の条件で検証を飛ばさない。
- 短いテストは段階を空行で区切る。開閉とフォーカス復帰のように操作の流れが仕様なら、操作と検証を繰り返してよい。長い Playwright テストは意味のある操作のまとまりを `test.step` で示す。
- 新規・変更するテストに適用する。既存テストの書式だけをそろえる一括変更は避ける。

```tsx
it("エラーを表示してもチェック状態とフォーカスを保つ", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Checkbox aria-label="行を選択" />);
  const checkbox = screen.getByRole("checkbox", { name: "行を選択" });
  await user.click(checkbox);
  expect(checkbox).toBeChecked();
  expect(checkbox).toHaveFocus();

  rerender(<Checkbox aria-label="行を選択" errorMessage="選択を確認してください。" />);

  const updatedCheckbox = screen.getByRole("checkbox", { name: "行を選択" });
  expect(updatedCheckbox).toBeChecked();
  expect(updatedCheckbox).toHaveFocus();
  expect(updatedCheckbox).toHaveAccessibleDescription("選択を確認してください。");
});
```
