import type { NativeLocale } from "../ui/types";

interface DrawingConsentCopy {
  title: string;
  body: string;
  privacy: string;
  cancel: string;
  continue: string;
  withdraw: string;
  withdrawn: string;
}

const COPY: Record<NativeLocale, DrawingConsentCopy> = {
  en: {
    title: "Before we draw",
    body: "Allow Doodle to send your descriptions and selected photos to OpenAI to create drawings? You can withdraw permission in Settings.",
    privacy: "Privacy policy", cancel: "Cancel", continue: "Allow", withdraw: "Withdraw AI sharing permission", withdrawn: "Permission withdrawn. We’ll ask again before your next drawing.",
  },
  nl: {
    title: "Voordat we tekenen",
    body: "Mag Doodle je beschrijvingen en gekozen foto’s naar OpenAI sturen om tekeningen te maken? Je kunt je toestemming intrekken in Instellingen.",
    privacy: "Privacybeleid", cancel: "Annuleren", continue: "Toestaan", withdraw: "Toestemming voor delen met AI intrekken", withdrawn: "Toestemming ingetrokken. Voor je volgende tekening vragen we het opnieuw.",
  },
  de: {
    title: "Bevor wir zeichnen",
    body: "Darf Doodle deine Beschreibungen und ausgewählten Fotos an OpenAI senden, um Zeichnungen zu erstellen? Du kannst die Erlaubnis in den Einstellungen widerrufen.",
    privacy: "Datenschutz", cancel: "Abbrechen", continue: "Erlauben", withdraw: "Erlaubnis zur KI-Datenweitergabe widerrufen", withdrawn: "Erlaubnis widerrufen. Vor deiner nächsten Zeichnung fragen wir erneut.",
  },
  fr: {
    title: "Avant de dessiner",
    body: "Autoriser Doodle à envoyer vos descriptions et photos sélectionnées à OpenAI pour créer des dessins ? Vous pouvez retirer cette autorisation dans les réglages.",
    privacy: "Confidentialité", cancel: "Annuler", continue: "Autoriser", withdraw: "Retirer l’autorisation de partage avec l’IA", withdrawn: "Autorisation retirée. Nous vous la demanderons avant votre prochain dessin.",
  },
  es: {
    title: "Antes de dibujar",
    body: "¿Permites que Doodle envíe tus descripciones y fotos seleccionadas a OpenAI para crear dibujos? Puedes retirar el permiso en Ajustes.",
    privacy: "Privacidad", cancel: "Cancelar", continue: "Permitir", withdraw: "Retirar permiso para compartir con IA", withdrawn: "Permiso retirado. Te lo pediremos antes de tu próximo dibujo.",
  },
  "pt-br": {
    title: "Antes de desenhar",
    body: "Permitir que o Doodle envie suas descrições e fotos selecionadas à OpenAI para criar desenhos? Você pode retirar a permissão em Configurações.",
    privacy: "Privacidade", cancel: "Cancelar", continue: "Permitir", withdraw: "Retirar permissão de compartilhamento com IA", withdrawn: "Permissão retirada. Vamos pedir novamente antes do seu próximo desenho.",
  },
  it: {
    title: "Prima di disegnare",
    body: "Consenti a Doodle di inviare le descrizioni e le foto selezionate a OpenAI per creare disegni? Puoi revocare il consenso nelle Impostazioni.",
    privacy: "Privacy", cancel: "Annulla", continue: "Consenti", withdraw: "Revoca il consenso alla condivisione con l’IA", withdrawn: "Consenso revocato. Te lo chiederemo prima del prossimo disegno.",
  },
  ja: {
    title: "描く前に",
    body: "イラスト作成のため、Doodleが説明と選択した写真をOpenAIに送信することを許可しますか？設定で許可を取り消せます。",
    privacy: "プライバシーポリシー", cancel: "キャンセル", continue: "許可する", withdraw: "AIへのデータ共有の許可を取り消す", withdrawn: "許可を取り消しました。次の描画前にもう一度確認します。",
  },
  ko: {
    title: "그리기 전에",
    body: "그림을 만들기 위해 Doodle이 설명과 선택한 사진을 OpenAI에 전송하도록 허용할까요? 설정에서 허용을 철회할 수 있어요.",
    privacy: "개인정보 처리방침", cancel: "취소", continue: "허용", withdraw: "AI 데이터 공유 허용 철회", withdrawn: "허용을 철회했어요. 다음 그림 전에 다시 확인할게요.",
  },
  ar: {
    title: "قبل أن نرسم",
    body: "هل تسمح لـ Doodle بإرسال أوصافك والصور التي تختارها إلى OpenAI لإنشاء الرسومات؟ يمكنك سحب الإذن من الإعدادات.",
    privacy: "سياسة الخصوصية", cancel: "إلغاء", continue: "السماح", withdraw: "سحب إذن مشاركة البيانات مع الذكاء الاصطناعي", withdrawn: "تم سحب الإذن. سنطلبه مجددًا قبل رسمتك القادمة.",
  },
};

export function getDrawingConsentCopy(locale: NativeLocale): DrawingConsentCopy { return COPY[locale]; }
