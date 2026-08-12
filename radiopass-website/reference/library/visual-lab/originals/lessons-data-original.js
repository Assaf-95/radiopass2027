(function buildLessonCatalogue() {
  const registry = window.visualConceptRegistry || {};

  const topicAliases = {
    "X-ray": "Radiography & X-ray Physics",
    Radiography: "Radiography & X-ray Physics",
    "Basic Physics": "Radiography & X-ray Physics",
    PET: "Nuclear Medicine"
  };

  window.FRCR_LESSON_TOPICS = [
    "MRI",
    "CT",
    "Radiography & X-ray Physics",
    "Ultrasound",
    "Mammography",
    "Nuclear Medicine",
    "Radiation Protection",
    "Radiotherapy"
  ];

  // The visual registry remains the single source of truth for lesson metadata.
  window.FRCR_LESSONS = Object.entries(registry)
    .filter(([, lesson]) => lesson.filePath)
    .map(([id, lesson]) => ({
      id,
      title: lesson.title,
      description: lesson.description || lesson.fallbackText || "Interactive FRCR physics visual lesson.",
      topic: topicAliases[lesson.modality] || lesson.modality || "Other",
      href: lesson.fullPath || lesson.filePath,
      keywords: [id, lesson.title, lesson.description, lesson.componentName, lesson.modality, lesson.fallbackText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
})();
