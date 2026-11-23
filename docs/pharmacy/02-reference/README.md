# マスタ・外部参照

[ドメイン一覧](../domain-candidates.md) の医薬品情報（`medicine_catalog`）および医療機関・外部関係者（`external_parties`）の仕様を定義する。

- [医薬品情報マスタ](medicine-catalog.md): 一般名・調剤単位製品・包装単位の3層構造、YJ/レセ電/GS1/JANコード、薬価・経過措置・長期収載品選定療養区分・規制区分・ハイリスク薬・RMP資材・特定保険医療材料（`TO`）
- [医療機関・外部関係者マスタ](external-parties.md): 保険医療機関（7桁機関コード・届出情報）、処方医（保険医確認・麻薬施用者番号）、介護施設（施設種別による算定分岐）、ケアマネジャー、外部連携薬局（在宅協力薬局・分譲相手先）
- [インタラクティブ図解 (HTML)](diagram.html): 3層医薬品マスタ構造、外部関係者マスタ、および下流コンテキストとの参照関係図

関連: [処方・調剤](../04-prescription-dispensing/README.md)、[在宅医療・訪問契約](../06-home-care/README.md)、[算定・会計・請求](../07-reimbursement-billing/README.md)、[在庫・物販](../08-inventory-retail/README.md)。
