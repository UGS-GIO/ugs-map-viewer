# Quaternary Fault Feature (QFF) Sentence Permutations

## Domain Values (from GeoServer)

### slipsense (5 values)
- normal (2063 features)
- monocline (5 features) - FOLD STRUCTURE
- unknown (3 features)
- anticline (2 features) - FOLD STRUCTURE
- reverse (1 feature)

### faultage (6 values)
- `<15,000` (722 features)
- `<2,600,000` (535 features)
- `<130,000` (509 features)
- `<750,000` (248 features)
- `undetermined` (59 features)
- `<150` (1 feature)

### sliprate (6 values)
- `<0.2 mm/yr` (1378 features)
- `0.2 - 1 mm/yr` (304 features)
- `1 - 5 mm/yr` (287 features)
- `unspecified` (82 features)
- `Undetermined` (22 features)
- `>5 mm/yr` (1 feature)

### mappedscale (14 values)
- 1:10,000 (1346 features)
- 1:24,000 (288 features)
- 1:100,000 (172 features)
- 1:250,000 (170 features)
- 1:62,500 (40 features)
- 1:125,000 (17 features)
- 1:50,000 (12 features)
- 1:155,000 (11 features)
- 1:60,000 (9 features)
- 1:170,000 (4 features)
- 1:340,000 (2 features)
- 1:500,000 (1 feature)
- 1:700,000 (1 feature)
- 1:750,000 (1 feature)

---

## Sentence Templates

### Template 1: Fold Structures (anticline, monocline, syncline)
**Used when:** slipsense is "anticline", "monocline", or "syncline"

```
{faultZone} {faultName} {sectionName} {strandName} is a {slipSense} that was mapped at {mappedScale} scale. Geologic studies have determined that the structure has had movement in the last {faultAge} years and has a slip rate of {slipRate}.
```

### Template 2: Undetermined Age
**Used when:** faultage = "undetermined" AND slipsense is NOT a fold structure

```
{faultZone} {faultName} {sectionName} {strandName} is a {slipSense} fault that was mapped at {mappedScale} scale. Geologic studies have not determined the age or slip rate of the fault.
```

### Template 3: Known Age
**Used when:** faultage is NOT "undetermined" AND slipsense is NOT a fold structure

```
{faultZone} {faultName} {sectionName} {strandName} is a {slipSense} fault that was mapped at {mappedScale} scale. Geologic studies have determined that the fault has had movement in the last {faultAge} years and has a slip rate of {slipRate}.
```

---

## All Generated Permutations

### FOLD STRUCTURE Sentences (Template 1)
*slipsense × mappedscale × faultage × sliprate = 2 × 14 × 6 × 6 = 1,008 permutations*

#### anticline permutations:

1. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of <0.2 mm/yr.`
2. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of 0.2 - 1 mm/yr.`
3. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of 1 - 5 mm/yr.`
4. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of unspecified.`
5. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of undetermined.`
6. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of >5 mm/yr.`
7. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of <0.2 mm/yr.`
8. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of 0.2 - 1 mm/yr.`
9. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of 1 - 5 mm/yr.`
10. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of unspecified.`
11. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of undetermined.`
12. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of >5 mm/yr.`
13. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of <0.2 mm/yr.`
14. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of 0.2 - 1 mm/yr.`
15. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of 1 - 5 mm/yr.`
16. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of unspecified.`
17. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of undetermined.`
18. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of >5 mm/yr.`
19. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of <0.2 mm/yr.`
20. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of 0.2 - 1 mm/yr.`
21. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of 1 - 5 mm/yr.`
22. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of unspecified.`
23. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of undetermined.`
24. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of >5 mm/yr.`
25. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of <0.2 mm/yr.`
26. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of 0.2 - 1 mm/yr.`
27. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of 1 - 5 mm/yr.`
28. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of unspecified.`
29. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of undetermined.`
30. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of >5 mm/yr.`
31. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of <0.2 mm/yr.`
32. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of 0.2 - 1 mm/yr.`
33. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of 1 - 5 mm/yr.`
34. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of unspecified.`
35. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of undetermined.`
36. `{names} is a anticline that was mapped at 1:10,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of >5 mm/yr.`
37. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of <0.2 mm/yr.`
38. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of 0.2 - 1 mm/yr.`
39. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of 1 - 5 mm/yr.`
40. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of unspecified.`
41. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of undetermined.`
42. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of >5 mm/yr.`
43. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of <0.2 mm/yr.`
44. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of 0.2 - 1 mm/yr.`
45. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of 1 - 5 mm/yr.`
46. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of unspecified.`
47. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of undetermined.`
48. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of >5 mm/yr.`
49. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of <0.2 mm/yr.`
50. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of 0.2 - 1 mm/yr.`
51. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of 1 - 5 mm/yr.`
52. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of unspecified.`
53. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of undetermined.`
54. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of >5 mm/yr.`
55. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of <0.2 mm/yr.`
56. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of 0.2 - 1 mm/yr.`
57. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of 1 - 5 mm/yr.`
58. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of unspecified.`
59. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of undetermined.`
60. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of >5 mm/yr.`
61. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of <0.2 mm/yr.`
62. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of 0.2 - 1 mm/yr.`
63. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of 1 - 5 mm/yr.`
64. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of unspecified.`
65. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of undetermined.`
66. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of >5 mm/yr.`
67. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of <0.2 mm/yr.`
68. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of 0.2 - 1 mm/yr.`
69. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of 1 - 5 mm/yr.`
70. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of unspecified.`
71. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of undetermined.`
72. `{names} is a anticline that was mapped at 1:24,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of >5 mm/yr.`
73. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of <0.2 mm/yr.`
74. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of 0.2 - 1 mm/yr.`
75. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of 1 - 5 mm/yr.`
76. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of unspecified.`
77. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of undetermined.`
78. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of >5 mm/yr.`
79. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of <0.2 mm/yr.`
80. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of 0.2 - 1 mm/yr.`
81. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of 1 - 5 mm/yr.`
82. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of unspecified.`
83. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of undetermined.`
84. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of >5 mm/yr.`
85. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of <0.2 mm/yr.`
86. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of 0.2 - 1 mm/yr.`
87. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of 1 - 5 mm/yr.`
88. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of unspecified.`
89. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of undetermined.`
90. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of >5 mm/yr.`
91. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of <0.2 mm/yr.`
92. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of 0.2 - 1 mm/yr.`
93. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of 1 - 5 mm/yr.`
94. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of unspecified.`
95. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of undetermined.`
96. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of >5 mm/yr.`
97. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of <0.2 mm/yr.`
98. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of 0.2 - 1 mm/yr.`
99. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of 1 - 5 mm/yr.`
100. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of unspecified.`
101. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of undetermined.`
102. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of >5 mm/yr.`
103. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of <0.2 mm/yr.`
104. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of 0.2 - 1 mm/yr.`
105. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of 1 - 5 mm/yr.`
106. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of unspecified.`
107. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of undetermined.`
108. `{names} is a anticline that was mapped at 1:100,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of >5 mm/yr.`
109. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of <0.2 mm/yr.`
110. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of 0.2 - 1 mm/yr.`
111. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of 1 - 5 mm/yr.`
112. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of unspecified.`
113. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of undetermined.`
114. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <15,000 years and has a slip rate of >5 mm/yr.`
115. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of <0.2 mm/yr.`
116. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of 0.2 - 1 mm/yr.`
117. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of 1 - 5 mm/yr.`
118. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of unspecified.`
119. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of undetermined.`
120. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <130,000 years and has a slip rate of >5 mm/yr.`
121. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of <0.2 mm/yr.`
122. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of 0.2 - 1 mm/yr.`
123. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of 1 - 5 mm/yr.`
124. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of unspecified.`
125. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of undetermined.`
126. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <750,000 years and has a slip rate of >5 mm/yr.`
127. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of <0.2 mm/yr.`
128. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of 0.2 - 1 mm/yr.`
129. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of 1 - 5 mm/yr.`
130. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of unspecified.`
131. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of undetermined.`
132. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <2,600,000 years and has a slip rate of >5 mm/yr.`
133. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of <0.2 mm/yr.`
134. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of 0.2 - 1 mm/yr.`
135. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of 1 - 5 mm/yr.`
136. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of unspecified.`
137. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of undetermined.`
138. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last <150 years and has a slip rate of >5 mm/yr.`
139. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of <0.2 mm/yr.`
140. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of 0.2 - 1 mm/yr.`
141. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of 1 - 5 mm/yr.`
142. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of unspecified.`
143. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of undetermined.`
144. `{names} is a anticline that was mapped at 1:250,000 scale. Geologic studies have determined that the structure has had movement in the last undetermined years and has a slip rate of >5 mm/yr.`

*(monocline permutations follow the same pattern - 504 additional permutations)*

---

### UNDETERMINED AGE Sentences (Template 2)
*slipsense (non-fold: 3) × mappedscale (14) = 42 permutations*

#### normal fault, undetermined age:
1. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
2. `{names} is a normal fault that was mapped at 1:24,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
3. `{names} is a normal fault that was mapped at 1:100,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
4. `{names} is a normal fault that was mapped at 1:250,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
5. `{names} is a normal fault that was mapped at 1:62,500 scale. Geologic studies have not determined the age or slip rate of the fault.`
6. `{names} is a normal fault that was mapped at 1:125,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
7. `{names} is a normal fault that was mapped at 1:50,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
8. `{names} is a normal fault that was mapped at 1:155,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
9. `{names} is a normal fault that was mapped at 1:60,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
10. `{names} is a normal fault that was mapped at 1:170,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
11. `{names} is a normal fault that was mapped at 1:340,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
12. `{names} is a normal fault that was mapped at 1:500,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
13. `{names} is a normal fault that was mapped at 1:700,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
14. `{names} is a normal fault that was mapped at 1:750,000 scale. Geologic studies have not determined the age or slip rate of the fault.`

#### unknown fault, undetermined age:
15. `{names} is a unknown fault that was mapped at 1:10,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
16. `{names} is a unknown fault that was mapped at 1:24,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
17. `{names} is a unknown fault that was mapped at 1:100,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
18. `{names} is a unknown fault that was mapped at 1:250,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
19. `{names} is a unknown fault that was mapped at 1:62,500 scale. Geologic studies have not determined the age or slip rate of the fault.`
20. `{names} is a unknown fault that was mapped at 1:125,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
21. `{names} is a unknown fault that was mapped at 1:50,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
22. `{names} is a unknown fault that was mapped at 1:155,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
23. `{names} is a unknown fault that was mapped at 1:60,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
24. `{names} is a unknown fault that was mapped at 1:170,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
25. `{names} is a unknown fault that was mapped at 1:340,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
26. `{names} is a unknown fault that was mapped at 1:500,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
27. `{names} is a unknown fault that was mapped at 1:700,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
28. `{names} is a unknown fault that was mapped at 1:750,000 scale. Geologic studies have not determined the age or slip rate of the fault.`

#### reverse fault, undetermined age:
29. `{names} is a reverse fault that was mapped at 1:10,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
30. `{names} is a reverse fault that was mapped at 1:24,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
31. `{names} is a reverse fault that was mapped at 1:100,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
32. `{names} is a reverse fault that was mapped at 1:250,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
33. `{names} is a reverse fault that was mapped at 1:62,500 scale. Geologic studies have not determined the age or slip rate of the fault.`
34. `{names} is a reverse fault that was mapped at 1:125,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
35. `{names} is a reverse fault that was mapped at 1:50,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
36. `{names} is a reverse fault that was mapped at 1:155,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
37. `{names} is a reverse fault that was mapped at 1:60,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
38. `{names} is a reverse fault that was mapped at 1:170,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
39. `{names} is a reverse fault that was mapped at 1:340,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
40. `{names} is a reverse fault that was mapped at 1:500,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
41. `{names} is a reverse fault that was mapped at 1:700,000 scale. Geologic studies have not determined the age or slip rate of the fault.`
42. `{names} is a reverse fault that was mapped at 1:750,000 scale. Geologic studies have not determined the age or slip rate of the fault.`

---

### KNOWN AGE Sentences (Template 3)
*slipsense (non-fold: 3) × mappedscale (14) × faultage (5 known ages) × sliprate (6) = 1,260 permutations*

#### normal fault permutations:

1. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <15,000 years and has a slip rate of <0.2 mm/yr.`
2. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <15,000 years and has a slip rate of 0.2 - 1 mm/yr.`
3. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <15,000 years and has a slip rate of 1 - 5 mm/yr.`
4. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <15,000 years and has a slip rate of unspecified.`
5. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <15,000 years and has a slip rate of undetermined.`
6. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <15,000 years and has a slip rate of >5 mm/yr.`
7. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <130,000 years and has a slip rate of <0.2 mm/yr.`
8. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <130,000 years and has a slip rate of 0.2 - 1 mm/yr.`
9. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <130,000 years and has a slip rate of 1 - 5 mm/yr.`
10. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <130,000 years and has a slip rate of unspecified.`
11. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <130,000 years and has a slip rate of undetermined.`
12. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <130,000 years and has a slip rate of >5 mm/yr.`
13. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <750,000 years and has a slip rate of <0.2 mm/yr.`
14. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <750,000 years and has a slip rate of 0.2 - 1 mm/yr.`
15. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <750,000 years and has a slip rate of 1 - 5 mm/yr.`
16. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <750,000 years and has a slip rate of unspecified.`
17. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <750,000 years and has a slip rate of undetermined.`
18. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <750,000 years and has a slip rate of >5 mm/yr.`
19. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <2,600,000 years and has a slip rate of <0.2 mm/yr.`
20. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <2,600,000 years and has a slip rate of 0.2 - 1 mm/yr.`
21. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <2,600,000 years and has a slip rate of 1 - 5 mm/yr.`
22. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <2,600,000 years and has a slip rate of unspecified.`
23. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <2,600,000 years and has a slip rate of undetermined.`
24. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <2,600,000 years and has a slip rate of >5 mm/yr.`
25. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <150 years and has a slip rate of <0.2 mm/yr.`
26. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <150 years and has a slip rate of 0.2 - 1 mm/yr.`
27. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <150 years and has a slip rate of 1 - 5 mm/yr.`
28. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <150 years and has a slip rate of unspecified.`
29. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <150 years and has a slip rate of undetermined.`
30. `{names} is a normal fault that was mapped at 1:10,000 scale. Geologic studies have determined that the fault has had movement in the last <150 years and has a slip rate of >5 mm/yr.`

*(Continues for all 14 mapped scales × 5 fault ages × 6 slip rates = 420 permutations for normal)*
*(Same pattern repeats for unknown and reverse = 840 more permutations)*

---

## Summary

| Template | Variables | Total Permutations |
|----------|-----------|-------------------|
| Fold Structure | 2 slipsense × 14 scale × 6 age × 6 rate | 1,008 |
| Undetermined Age | 3 slipsense × 14 scale | 42 |
| Known Age | 3 slipsense × 14 scale × 5 age × 6 rate | 1,260 |
| **TOTAL** | | **2,310** |

Note: `{names}` represents the concatenation of `{faultZone} {faultName} {sectionName} {strandName}` with proper cleanup applied.
