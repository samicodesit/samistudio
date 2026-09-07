import type { Locale } from "@/lib/i18n";
import type { ReportReason } from "./report-types";

export type ReportCopy = {
  trigger: string;
  title: string;
  intro: string;
  reasonLabel: string;
  chooseReason: string;
  reasons: Record<ReportReason, string>;
  detailsOptional: string;
  detailsRequired: string;
  detailsPlaceholder: string;
  includeContent: string;
  submit: string;
  cancel: string;
  close: string;
  success: string;
  reference: string;
  error: string;
};

const ENGLISH: ReportCopy = {
  trigger: "Report this doodle",
  title: "Report this doodle",
  intro: "Tell us what is wrong so we can review it.",
  reasonLabel: "Why are you reporting this doodle?",
  chooseReason: "Choose a reason",
  reasons: {
    sexual: "Sexual content",
    violence: "Violence or injury",
    hate: "Hate or harassment",
    "self-harm": "Self-harm",
    other: "Other unsafe content",
  },
  detailsOptional: "Add details (optional)",
  detailsRequired: "Add details (required)",
  detailsPlaceholder: "Briefly describe what is wrong",
  includeContent: "Include this doodle and its description. They will be uploaded and stored for up to 30 days so the report can be reviewed.",
  submit: "Submit report",
  cancel: "Cancel",
  close: "Close",
  success: "Report received.",
  reference: "Reference",
  error: "The report could not be submitted. Please try again.",
};

// Localized variants are kept beside the reporting feature so its consent text
// cannot drift from the data the feature actually submits.
export const REPORT_COPY: Record<Locale, ReportCopy> = {
  en: ENGLISH,
  nl: { ...ENGLISH, trigger: "Deze doodle melden", title: "Deze doodle melden", intro: "Vertel ons wat er mis is, zodat we het kunnen beoordelen.", reasonLabel: "Waarom meld je deze doodle?", chooseReason: "Kies een reden", reasons: { sexual: "Seksuele inhoud", violence: "Geweld of letsel", hate: "Haat of intimidatie", "self-harm": "Zelfbeschadiging", other: "Andere onveilige inhoud" }, detailsOptional: "Details toevoegen (optioneel)", detailsRequired: "Details toevoegen (verplicht)", detailsPlaceholder: "Beschrijf kort wat er mis is", includeContent: "Voeg deze doodle en de beschrijving toe. Ze worden geüpload en maximaal 30 dagen bewaard zodat de melding kan worden beoordeeld.", submit: "Melding versturen", cancel: "Annuleren", close: "Sluiten", success: "Melding ontvangen.", reference: "Referentie", error: "De melding kon niet worden verstuurd. Probeer het opnieuw." },
  de: { ...ENGLISH, trigger: "Doodle melden", title: "Doodle melden", intro: "Beschreibe das Problem, damit wir es prüfen können.", reasonLabel: "Warum meldest du dieses Doodle?", chooseReason: "Grund auswählen", reasons: { sexual: "Sexuelle Inhalte", violence: "Gewalt oder Verletzung", hate: "Hass oder Belästigung", "self-harm": "Selbstverletzung", other: "Andere unsichere Inhalte" }, detailsOptional: "Details hinzufügen (optional)", detailsRequired: "Details hinzufügen (erforderlich)", detailsPlaceholder: "Beschreibe kurz das Problem", includeContent: "Dieses Doodle und seine Beschreibung mitsenden. Sie werden hochgeladen und zur Prüfung bis zu 30 Tage gespeichert.", submit: "Meldung senden", cancel: "Abbrechen", close: "Schließen", success: "Meldung eingegangen.", reference: "Referenz", error: "Die Meldung konnte nicht gesendet werden. Bitte versuche es erneut." },
  fr: { ...ENGLISH, trigger: "Signaler ce dessin", title: "Signaler ce dessin", intro: "Indiquez ce qui ne va pas afin que nous puissions l’examiner.", reasonLabel: "Pourquoi signalez-vous ce dessin ?", chooseReason: "Choisir un motif", reasons: { sexual: "Contenu sexuel", violence: "Violence ou blessure", hate: "Haine ou harcèlement", "self-harm": "Automutilation", other: "Autre contenu dangereux" }, detailsOptional: "Ajouter des détails (facultatif)", detailsRequired: "Ajouter des détails (obligatoire)", detailsPlaceholder: "Décrivez brièvement le problème", includeContent: "Joindre ce dessin et sa description. Ils seront importés et conservés jusqu’à 30 jours pour examiner le signalement.", submit: "Envoyer le signalement", cancel: "Annuler", close: "Fermer", success: "Signalement reçu.", reference: "Référence", error: "Le signalement n’a pas pu être envoyé. Réessayez." },
  es: { ...ENGLISH, trigger: "Denunciar este dibujo", title: "Denunciar este dibujo", intro: "Cuéntanos qué está mal para que podamos revisarlo.", reasonLabel: "¿Por qué denuncias este dibujo?", chooseReason: "Elige un motivo", reasons: { sexual: "Contenido sexual", violence: "Violencia o lesiones", hate: "Odio o acoso", "self-harm": "Autolesiones", other: "Otro contenido inseguro" }, detailsOptional: "Añadir detalles (opcional)", detailsRequired: "Añadir detalles (obligatorio)", detailsPlaceholder: "Describe brevemente qué está mal", includeContent: "Incluye este dibujo y su descripción. Se subirán y conservarán hasta 30 días para revisar la denuncia.", submit: "Enviar denuncia", cancel: "Cancelar", close: "Cerrar", success: "Denuncia recibida.", reference: "Referencia", error: "No se pudo enviar la denuncia. Inténtalo de nuevo." },
  "pt-br": { ...ENGLISH, trigger: "Denunciar este desenho", title: "Denunciar este desenho", intro: "Conte o que há de errado para que possamos analisar.", reasonLabel: "Por que você está denunciando este desenho?", chooseReason: "Escolha um motivo", reasons: { sexual: "Conteúdo sexual", violence: "Violência ou ferimento", hate: "Ódio ou assédio", "self-harm": "Automutilação", other: "Outro conteúdo inseguro" }, detailsOptional: "Adicionar detalhes (opcional)", detailsRequired: "Adicionar detalhes (obrigatório)", detailsPlaceholder: "Descreva brevemente o problema", includeContent: "Inclua este desenho e a descrição. Eles serão enviados e armazenados por até 30 dias para análise da denúncia.", submit: "Enviar denúncia", cancel: "Cancelar", close: "Fechar", success: "Denúncia recebida.", reference: "Referência", error: "Não foi possível enviar a denúncia. Tente novamente." },
  it: { ...ENGLISH, trigger: "Segnala questo doodle", title: "Segnala questo doodle", intro: "Descrivi il problema affinché possiamo esaminarlo.", reasonLabel: "Perché segnali questo doodle?", chooseReason: "Scegli un motivo", reasons: { sexual: "Contenuto sessuale", violence: "Violenza o lesioni", hate: "Odio o molestie", "self-harm": "Autolesionismo", other: "Altro contenuto non sicuro" }, detailsOptional: "Aggiungi dettagli (facoltativo)", detailsRequired: "Aggiungi dettagli (obbligatorio)", detailsPlaceholder: "Descrivi brevemente il problema", includeContent: "Includi questo doodle e la sua descrizione. Saranno caricati e conservati fino a 30 giorni per esaminare la segnalazione.", submit: "Invia segnalazione", cancel: "Annulla", close: "Chiudi", success: "Segnalazione ricevuta.", reference: "Riferimento", error: "Impossibile inviare la segnalazione. Riprova." },
  ja: { ...ENGLISH, trigger: "このイラストを報告", title: "このイラストを報告", intro: "確認できるよう、問題点をお知らせください。", reasonLabel: "このイラストを報告する理由は？", chooseReason: "理由を選択", reasons: { sexual: "性的な内容", violence: "暴力やけが", hate: "ヘイトや嫌がらせ", "self-harm": "自傷行為", other: "その他の危険な内容" }, detailsOptional: "詳細を追加（任意）", detailsRequired: "詳細を追加（必須）", detailsPlaceholder: "問題点を簡潔に説明してください", includeContent: "このイラストと説明文を含めます。報告確認のためアップロードされ、最長30日間保存されます。", submit: "報告を送信", cancel: "キャンセル", close: "閉じる", success: "報告を受け付けました。", reference: "参照番号", error: "報告を送信できませんでした。もう一度お試しください。" },
  ko: { ...ENGLISH, trigger: "이 그림 신고", title: "이 그림 신고", intro: "검토할 수 있도록 문제점을 알려 주세요.", reasonLabel: "이 그림을 신고하는 이유는 무엇인가요?", chooseReason: "이유 선택", reasons: { sexual: "성적인 콘텐츠", violence: "폭력 또는 부상", hate: "혐오 또는 괴롭힘", "self-harm": "자해", other: "기타 안전하지 않은 콘텐츠" }, detailsOptional: "세부 정보 추가(선택)", detailsRequired: "세부 정보 추가(필수)", detailsPlaceholder: "문제점을 간단히 설명해 주세요", includeContent: "이 그림과 설명을 포함합니다. 신고 검토를 위해 업로드되며 최대 30일 동안 보관됩니다.", submit: "신고 제출", cancel: "취소", close: "닫기", success: "신고가 접수되었습니다.", reference: "참조 번호", error: "신고를 제출하지 못했습니다. 다시 시도해 주세요." },
  ar: { ...ENGLISH, trigger: "الإبلاغ عن هذه الرسمة", title: "الإبلاغ عن هذه الرسمة", intro: "أخبرنا بالمشكلة حتى نتمكن من مراجعتها.", reasonLabel: "لماذا تبلغ عن هذه الرسمة؟", chooseReason: "اختر سببًا", reasons: { sexual: "محتوى جنسي", violence: "عنف أو إصابة", hate: "كراهية أو مضايقة", "self-harm": "إيذاء النفس", other: "محتوى آخر غير آمن" }, detailsOptional: "أضف تفاصيل (اختياري)", detailsRequired: "أضف تفاصيل (مطلوب)", detailsPlaceholder: "اشرح المشكلة باختصار", includeContent: "أرفق هذه الرسمة ووصفها. سيتم رفعهما والاحتفاظ بهما لمدة تصل إلى 30 يومًا لمراجعة البلاغ.", submit: "إرسال البلاغ", cancel: "إلغاء", close: "إغلاق", success: "تم استلام البلاغ.", reference: "المرجع", error: "تعذّر إرسال البلاغ. حاول مرة أخرى." },
};
