// Task content the AI examiner marks against. Keep in sync with public/index.html.
export const T1 = {
  desc: "The chart below shows the percentage of households with internet access in Canada, Brazil and India between 2005 and 2020.",
  years: [2005, 2010, 2015, 2020],
  series: [["Canada", [64, 78, 87, 94]], ["Brazil", [21, 38, 58, 81]], ["India", [3, 8, 22, 48]]],
};

export const T2 = [
  "Some people believe that university students should study whatever they like, while others think they should only study subjects that will be useful in the job market. Discuss both views and give your own opinion.",
  "In many countries, people are working from home more than before. Do the advantages of this development outweigh the disadvantages?",
  "Governments should spend more money on public transport than on building new roads. To what extent do you agree or disagree?",
  "Many young people today spend a lot of time on social media. What problems does this cause, and what can be done to solve them?",
];

export const SETS = [
  {
    p1: ["Do you live in a house or an apartment?", "What do you like most about your home?", "Is there anything you would like to change about where you live?", "Do you usually spend time at home at weekends? Why?"],
    cue: { t: "Describe a place you like to visit to relax.", pts: ["where it is", "how often you go there", "what you do there", "and explain why it helps you relax."] },
    p3: ["Why do many people find it hard to relax these days?", "Should employers do more to reduce stress at work?", "How has the way people spend their free time changed compared with the past?"],
  },
  {
    p1: ["Do you work or are you a student?", "What do you enjoy about your work or studies?", "Do you prefer working in the morning or the evening?", "What job did you want to do when you were a child?"],
    cue: { t: "Describe a skill you learned that has been useful to you.", pts: ["what the skill is", "when and how you learned it", "how difficult it was", "and explain why it has been useful."] },
    p3: ["Which skills will be most important for young people in the future?", "Is it better to learn skills at school or at work?", "Do you think technology makes people less skilled at some things?"],
  },
  {
    p1: ["What kind of food do you enjoy?", "Do you like cooking? Why or why not?", "Has your diet changed since you were a child?", "Do people in your country usually eat together as a family?"],
    cue: { t: "Describe a meal that you remember well.", pts: ["where you had it", "who you were with", "what you ate", "and explain why you remember it."] },
    p3: ["Why do traditional meals matter to families and cultures?", "How have fast food restaurants changed eating habits?", "Should schools teach children how to cook?"],
  },
];

export function speakingSteps(setIndex) {
  const s = SETS[setIndex];
  return [...s.p1.map((q) => ({ part: 1, q })), { part: 2, q: s.cue.t, cue: s.cue }, ...s.p3.map((q) => ({ part: 3, q }))];
}

export const LEVEL_VOICE = {
  beginner: "The student is a BEGINNER (about band 4-5). Use very simple English, short sentences, and explain every term.",
  intermediate: "The student is INTERMEDIATE (about band 5.5-6). Use clear, simple English and give practical examples.",
  advanced: "The student is ADVANCED (about band 6.5-7). Be precise and point out what separates 7 from 8.",
  professional: "The student is PROFESSIONAL level (band 7.5+). Be strict, examiner-like, and focus on fine distinctions.",
};
