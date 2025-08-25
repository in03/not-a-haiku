
The editor logic here is harder than you'd think!

## Numbers

The CMU dict and ML approach doesn't support numbers at all. RIP entity names that contain numbers lol e.g. "Cafe 63".
Might be able to support number normalization via a rule system easily. Don't want any more ML in chain for normalization unless very cheap.

For now, numbers and non-punctuation special characters are disabled. To combat pasting forbidden characters, we intercept pastes and pretend we disable them for plagiarism sake.

## Diffing

Considered introducing diffing to perform dict lookups and inference only on changes made to the overall haiku, but this would require a caching layer, which for such a short text is probably more trouble than its worth.

## Word submission quirks

Standalone letters could be interpreted as an acronym or as a word: "NA" could be "En Ay" (2) or "na". (1).
This is particularly troublesome for single letters. Of all of "abcdefghijklmnopqrstuvwxyz" only "w" and "x" are predicted by the model two have two syllables. "Double u" makes sense, but "ex" not so much. I could add these to the dictionary to be predicted as one syllable, but in the rare situation a user has a single letter acronym "W" they need detected as "double u", we're out of luck.

To counteract this, we can have a rule. a "space" after a given word is marking that word as done. To keep the validation running in real-time and feeling reactive, the syllable count must be updated predictively, but the validation itself only trigger on word submission (pressing space).

## Mobile quirks

Mobile users have access to autocorrect and autocomplete. These words fill instantly, completely overwhelming any ability to handle real-time characters in sync. Instead, the validation system must validate asynchronously and retrospectively. It must do this carefully, being able to handle a large overflow, looking backwards to determine if the line syllable limit met mid-word, or at word end, and trimming or newlining as necessary.

Text wrapping on mobile should be fully disabled so that lines are made explicit and clear.

