You have succesfully implemented a feature.  
Now, your job is to gather whatever text you have genrated in frontend and translate it in Arabic.
For example it could be header text or description, anything textual. Note it's filename, prompt from which this text was generated (its optional-ignore if you feel confused or undecided), main feature it is related to. (You dont need to translate filename, promptnumber filesrelated values in arabic).
Once translated, dump it in arabicdict.md file with following format:

Translation JSON: {"dashboard": "لوحة التحكم", "student": "طالب", "attendance": "حضور", "report": "تقرير", "featurerlated": "<feature name>", "promptnumber":"", "filesrelated": "<filesname seperated by comma>"  }

Remeber not to overwrite this file but to append to it. 
Remember DO NOT translate irrelevant backend or db things/labels. For example user_name as it is not user facing text. We only need whatever is displayed on frontend.
DO NOT read frontend codebase JUST TO translate irrelvant things like createTimingTemplatetitle or timingTemplateNameLabel. What is NOT written anywhere in my website SHOULD NOT be translated. 

You are reading a frontend codebase to look for relevant displayed text.For example, text displayed in frontend such as Dashboard, Settings, Assessment, Time Table. 