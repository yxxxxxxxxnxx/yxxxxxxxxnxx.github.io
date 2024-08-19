---
layout: post
title: W03 Team Mission
subtitle: Data Visualization
categories: DS'24
tags: [DatVis, Python]
---

# W3. Team Mission
---



```python
# 0. 라이브러리 및 데이터셋 로드

import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
%matplotlib inline

import os
if os.name == 'posix':
	plt.rc('font', family='AppleGothic')
else:
	plt.rc('font', family='Malgun Gothic')
plt.rc('axes', unicode_minus=False)
    # 시각화 한글 폰트 설정
%config InlineBackend.figure_format = 'retina'  # 가독성 향상

df = pd.read_csv("https://raw.githubusercontent.com/corazzon/boostcourse-ds-510/master/data/NHIS_OPEN_GJ_2017.CSV.zip", 
				 encoding="cp949")
    # 데이터셋 로드
```

---
## Q1.
'연령대코드(5세단위)' 범주형 데이터로 변환 및 허리둘레에 대한 기술통계량 산출


```python
age_code = {1: '0~4세',
            2: '5~9세',
            3: '10~14세',
            4: '15~19세',
            5: '20~24세',
            6: '25~29세',
            7: '30~34세',
            8: '35~39세',
            9: '40~44세',
            10: '45~49세',
            11: '50~54세',
            12: '55~59세',
            13: '60~64세',
            14: '65~69세',
            15: '70~74세',
            16: '75~79세',
            17: '80~84세',
            18: '85세+'}
```


```python
# 1. 주어진 딕셔너리 'age_code'를 Pandas 라이브러리의 .replace()에 대입
#    규칙에 따라 변환된 값들을 새로운 열 '연령대'에 추가

df['연령대'] = df['연령대코드(5세단위)'].replace(age_code)
df.head(1)
```




<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>기준년도</th>
      <th>가입자일련번호</th>
      <th>성별코드</th>
      <th>연령대코드(5세단위)</th>
      <th>시도코드</th>
      <th>신장(5Cm단위)</th>
      <th>체중(5Kg 단위)</th>
      <th>허리둘레</th>
      <th>시력(좌)</th>
      <th>시력(우)</th>
      <th>...</th>
      <th>흡연상태</th>
      <th>음주여부</th>
      <th>구강검진 수검여부</th>
      <th>치아우식증유무</th>
      <th>결손치유무</th>
      <th>치아마모증유무</th>
      <th>제3대구치(사랑니)이상</th>
      <th>치석</th>
      <th>데이터공개일자</th>
      <th>연령대</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2017</td>
      <td>1</td>
      <td>1</td>
      <td>13</td>
      <td>46</td>
      <td>170.0</td>
      <td>65.0</td>
      <td>91.0</td>
      <td>1.0</td>
      <td>1.2</td>
      <td>...</td>
      <td>3.0</td>
      <td>0.0</td>
      <td>1</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>1.0</td>
      <td>20181126</td>
      <td>60~64세</td>
    </tr>
  </tbody>
</table>
<p>1 rows × 35 columns</p>
</div>




```python
# 2. groupby()를 이용해 '연령대'별로 그룹화하고 '허리둘레'에 대한 통계량 산출

df.groupby(['연령대'])['허리둘레'].describe()
```




<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>count</th>
      <th>mean</th>
      <th>std</th>
      <th>min</th>
      <th>25%</th>
      <th>50%</th>
      <th>75%</th>
      <th>max</th>
    </tr>
    <tr>
      <th>연령대</th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>20~24세</th>
      <td>23244.0</td>
      <td>75.152220</td>
      <td>12.251781</td>
      <td>47.5</td>
      <td>67.5</td>
      <td>73.4</td>
      <td>81.0</td>
      <td>999.0</td>
    </tr>
    <tr>
      <th>25~29세</th>
      <td>64898.0</td>
      <td>77.704783</td>
      <td>16.735734</td>
      <td>48.0</td>
      <td>69.0</td>
      <td>76.5</td>
      <td>84.2</td>
      <td>999.0</td>
    </tr>
    <tr>
      <th>30~34세</th>
      <td>77517.0</td>
      <td>81.089268</td>
      <td>22.988111</td>
      <td>49.0</td>
      <td>72.0</td>
      <td>80.1</td>
      <td>88.0</td>
      <td>999.0</td>
    </tr>
    <tr>
      <th>35~39세</th>
      <td>84621.0</td>
      <td>82.094012</td>
      <td>14.522095</td>
      <td>9.2</td>
      <td>75.0</td>
      <td>82.0</td>
      <td>89.0</td>
      <td>999.0</td>
    </tr>
    <tr>
      <th>40~44세</th>
      <td>130912.0</td>
      <td>80.488308</td>
      <td>10.803098</td>
      <td>42.1</td>
      <td>73.0</td>
      <td>80.0</td>
      <td>87.0</td>
      <td>999.0</td>
    </tr>
    <tr>
      <th>45~49세</th>
      <td>118357.0</td>
      <td>80.822449</td>
      <td>9.521622</td>
      <td>40.0</td>
      <td>74.0</td>
      <td>81.0</td>
      <td>87.0</td>
      <td>137.0</td>
    </tr>
    <tr>
      <th>50~54세</th>
      <td>129833.0</td>
      <td>81.062754</td>
      <td>9.095438</td>
      <td>6.5</td>
      <td>75.0</td>
      <td>81.0</td>
      <td>87.0</td>
      <td>142.0</td>
    </tr>
    <tr>
      <th>55~59세</th>
      <td>112175.0</td>
      <td>81.799905</td>
      <td>8.730398</td>
      <td>32.0</td>
      <td>76.0</td>
      <td>82.0</td>
      <td>87.5</td>
      <td>139.0</td>
    </tr>
    <tr>
      <th>60~64세</th>
      <td>106491.0</td>
      <td>82.722769</td>
      <td>8.596176</td>
      <td>0.0</td>
      <td>77.0</td>
      <td>83.0</td>
      <td>88.0</td>
      <td>137.0</td>
    </tr>
    <tr>
      <th>65~69세</th>
      <td>53624.0</td>
      <td>83.588500</td>
      <td>8.443542</td>
      <td>50.0</td>
      <td>78.0</td>
      <td>83.5</td>
      <td>89.0</td>
      <td>129.0</td>
    </tr>
    <tr>
      <th>70~74세</th>
      <td>51586.0</td>
      <td>84.063372</td>
      <td>8.539639</td>
      <td>51.0</td>
      <td>78.0</td>
      <td>84.0</td>
      <td>90.0</td>
      <td>129.8</td>
    </tr>
    <tr>
      <th>75~79세</th>
      <td>25972.0</td>
      <td>84.200127</td>
      <td>8.772306</td>
      <td>50.0</td>
      <td>78.0</td>
      <td>84.0</td>
      <td>90.0</td>
      <td>122.0</td>
    </tr>
    <tr>
      <th>80~84세</th>
      <td>16205.0</td>
      <td>83.751435</td>
      <td>9.041091</td>
      <td>38.0</td>
      <td>78.0</td>
      <td>84.0</td>
      <td>90.0</td>
      <td>120.0</td>
    </tr>
    <tr>
      <th>85세+</th>
      <td>4125.0</td>
      <td>81.736703</td>
      <td>17.325969</td>
      <td>34.0</td>
      <td>75.0</td>
      <td>81.5</td>
      <td>88.0</td>
      <td>999.0</td>
    </tr>
  </tbody>
</table>
</div>




```python
# 3. 연령대별 '허리둘레' 통계량 시각화
#    데이터의 분포 유형 및 최대/최소값, 사분위수 등 통계량을 살필 수 있는 boxplot으로 시각화

plt.figure(figsize=(20, 10))
sns.boxplot(data=df, x='연령대', y='허리둘레', order=age_code.values(), color='#3B9AB2')
    # order= : 위 딕셔너리를 활용, 키-값 정의 순서대로 x축 범주 순서 지정
    # order=None (default) : 데이터셋의 행 데이터 읽기 순서대로 표현
plt.ylim(0, 200)
    # 데이터가 존재하지 않는 200-999 구간 제외 (999 측정 오류로 간주)

plt.show()
```


    
![png](/assets/images/W03_files/W03_6_0.png)
    


---
## Q2.
'음주여부', '흡연상태', '연령대코드(5세단위)', '성별코드'에 대한 상관계수 산출 및 시각화


```python
# 1. '음주여부', '흡연상태', '연령대코드(5세단위)', '성별코드'의 상관계수 계산
#    .loc를 이용해 모든 행 및 관심 있는 열로 추리고,
#    .corr()로 상관계수를 산출하여 df_corr 변수에 할당 

df_corr = df.loc[:, ['음주여부', '흡연상태', '연령대코드(5세단위)', '성별코드']].corr()
df_corr
```




<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>음주여부</th>
      <th>흡연상태</th>
      <th>연령대코드(5세단위)</th>
      <th>성별코드</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>음주여부</th>
      <td>1.000000</td>
      <td>0.352014</td>
      <td>-0.283296</td>
      <td>-0.368630</td>
    </tr>
    <tr>
      <th>흡연상태</th>
      <td>0.352014</td>
      <td>1.000000</td>
      <td>-0.125714</td>
      <td>-0.588491</td>
    </tr>
    <tr>
      <th>연령대코드(5세단위)</th>
      <td>-0.283296</td>
      <td>-0.125714</td>
      <td>1.000000</td>
      <td>0.080093</td>
    </tr>
    <tr>
      <th>성별코드</th>
      <td>-0.368630</td>
      <td>-0.588491</td>
      <td>0.080093</td>
      <td>1.000000</td>
    </tr>
  </tbody>
</table>
</div>




```python
# 2. Heatmap으로 시각화
#	 중복되는 원소가 표시되지 않도록 mask 구문 활용

mask = np.triu(np.ones_like(df_corr, dtype=bool))  # 대각선 이하 원소만 표현 (하삼각행렬 형태), 대각선 이상 마스킹

plt.figure(figsize=(10, 10))
sns.heatmap(df_corr, mask=mask, annot=True, fmt='.2f', cmap='coolwarm', vmax=1.0, vmin=-1.0)
	# mask=mask : 대각선 이하 원소만 표현 (대각선 이상 마스킹)
	# annot=True : 상관계수 값 표시
	# fmt='.2f' : 상관계수 값 포맷 지정 (소수점 이하 2자리 float 자료형)
	# cmap= : 컬러 스케일 지정 (양/음의 상관관계 정도를 나타낼 수 있도록 발산형 팔레트 지정)
	# vmax, vmin : 최대값, 최소값 지정 (데이터 분포와 무관하게 상관계수가 가질 수 있는 최소/최대값에 따라 색상이 표현되도록 강제 지정)
    
plt.show()
```


    
![png](/assets/images/W03_files/W03_9_0.png)
    


---
## Q3.
표본 내 흡연인구, 음주인구 규모 비교 및 시각화
* groupby, pivot_table로 구할 수도 있지만, 수업에서는 다루지 않았던 **pandas의 `crosstab` 기능**을 사용해서도 비교적 쉽게 구할 수 있습니다.
* 그리고 **막대그래프**를 통해 결과를 시각화해주세요!


```python
smoke = {1 : "흡연안함", 2: "끊음", 3: "흡연중"}
drink = {0: "안마심", 1: "마심"}
```


```python
# 1. 주어진 딕셔너리 'smoke', 'drink'를 활용,
#    '흡연상태', '음주여부'의 값을 범주형 데이터로 변환

df['흡연'] = df['흡연상태'].replace(smoke)
df['음주'] = df['음주여부'].replace(drink)
df.head(1)

# 또는 .map을 사용한 매핑 방식으로 범주형 데이터로 변환 가능
# df['흡연'] = df['흡연상태'].map(smoke)
# df['음주'] = df['음주여부'].map(drink)
# df.head(1)
```




<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th>기준년도</th>
      <th>가입자일련번호</th>
      <th>성별코드</th>
      <th>연령대코드(5세단위)</th>
      <th>시도코드</th>
      <th>신장(5Cm단위)</th>
      <th>체중(5Kg 단위)</th>
      <th>허리둘레</th>
      <th>시력(좌)</th>
      <th>시력(우)</th>
      <th>...</th>
      <th>구강검진 수검여부</th>
      <th>치아우식증유무</th>
      <th>결손치유무</th>
      <th>치아마모증유무</th>
      <th>제3대구치(사랑니)이상</th>
      <th>치석</th>
      <th>데이터공개일자</th>
      <th>연령대</th>
      <th>흡연</th>
      <th>음주</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>0</th>
      <td>2017</td>
      <td>1</td>
      <td>1</td>
      <td>13</td>
      <td>46</td>
      <td>170.0</td>
      <td>65.0</td>
      <td>91.0</td>
      <td>1.0</td>
      <td>1.2</td>
      <td>...</td>
      <td>1</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>NaN</td>
      <td>1.0</td>
      <td>20181126</td>
      <td>60~64세</td>
      <td>흡연중</td>
      <td>안마심</td>
    </tr>
  </tbody>
</table>
<p>1 rows × 37 columns</p>
</div>




```python
# 2. .crosstab()을 사용하여 '흡연상태'별, '음주여부'별 데이터 수 산출

df_smdr = pd.crosstab(df['음주'], df['흡연'])
df_smdr

# 또는 groupby를 사용하고자 할 경우, 다음과 같이 표현 가능
# df_smdr = df.groupby(['음주', '흡연']).size().unstack(fill_value=0)
# df_smdr
```




<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th>흡연</th>
      <th>끊음</th>
      <th>흡연안함</th>
      <th>흡연중</th>
    </tr>
    <tr>
      <th>음주</th>
      <th></th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>마심</th>
      <td>120779</td>
      <td>213743</td>
      <td>162166</td>
    </tr>
    <tr>
      <th>안마심</th>
      <td>55334</td>
      <td>394503</td>
      <td>52845</td>
    </tr>
  </tbody>
</table>
</div>




```python
# 3. 막대그래프로 시각화

plt.figure(figsize=(10, 10))
sns.countplot(data=df, x='흡연', hue='음주', palette=['#3B9AB2', '#F21A00'], gap=0.1)
    # gap= : 시각화 자료의 가독성 확보를 위해 막대 사이 간격 조정

plt.show()
```


    
![png](/assets/images/W03_files/W03_14_0.png)
    



```python
# 4. 누적막대그래프로 시각화
#    표본 집단 중 흡연/음주 상태별 규모를 비교하고, 각 상태와 인접 요인(흡연/음주)의 연동성 파악에 용이
#    1) 비흡연 인구가 흡연 및 금연 인구보다 큼
#       음주자 수는 비흡연 그룹에 가장 많은 것으로 보이지만, 비율로 따졌을 때 흡연자이면서 음주자일 가능성이 가장 큼  
#    2) 음주/비음주 인구는 규모 면에서 유사
#       음주자일 경우 동시에 흡연자일 가능성이 비음주자 그룹에 비해 크지만, 현재 흡연 중이 아닐 가능성이 더 큼 (흡연안함+끊음)
#       비음주자는 애초에 흡연을 하지 않았을 가능성이 가장 큼

fig, ax = plt.subplots(1, 2, figsize=(10, 5))

sns.countplot(data=df, x='흡연', color='#3B9AB2', ax=ax[0])
sns.countplot(data=df[df['음주'] == "마심"], x='흡연', color='#F21A00', ax=ax[0])
    # seaborn에서의 누적막대그래프 : 두 개의 그래프를 중접하거나 bottom= 구문을 이용해 쌓음

df_smdr.plot.bar(stacked=True, color=['#F2AD00', '#00A08A', '#000000'], ax=ax[1])
    # pandas에서의 누적막대그래프 : stacked=True
plt.xticks(rotation=0)
plt.legend(loc='lower right')

plt.show()
```


    
![png](/assets/images/W03_files/W03_15_0.png)
    


---
## Q4.
체중이 120kg 이상인 데이터의 '총콜레스테롤', '감마지티피', '음주여부'값을 '흡연상태'에 따라 산점도로 시각화
* 120Kg 이상인 데이터를 찾아 "총콜레스테롤", "감마지티피" 값을 음주여부에 따라 **산점도로 시각화**해주세요! (이때 120Kg 도 포함되게 구합니다.)


```python
# 1. 체중이 120kg 이상인 데이터 슬라이싱

df_weight_over_120 = df[df['체중(5Kg 단위)'] >= 120]
df_weight_over_120.shape
```




    (1181, 37)




```python
# 2. '총콜레스테롤', '감마지티피', '음주여부'를 '흡연상태'별로 산점도로 시각화

plt.figure(figsize=(15, 5))
sns.lmplot(data=df_weight_over_120, x='총콜레스테롤', y='감마지티피', hue='음주', col='흡연', 
           palette=['#3B9AB2', '#F21A00'], scatter_kws={'alpha': 0.5, 'edgecolor': 'black'})
    # alpha, edgecolor : 시각화 자료의 가독성 확보를 위해 각 포인터의 투명도 및 윤곽선 조정

plt.show()
```


    <Figure size 1500x500 with 0 Axes>



    
![png](/assets/images/W03_files/W03_18_1.png)
    


---
## Q5.
'연령대', '성별코드'별 좌우평균시력 시각화
* 시력은 **0.1~2.5 사이의 값으로 표기**하며 **0.1 이하의 시력은 0.1, 실명은 9.9로 표기**합니다.
* 실명인 데이터를 평균에 포함하게 되면 시력에 대한 평균을 제대로 구하기 어렵습니다.<br>**실명 데이터를 제외**하고 연령대, 성별에 따른 평균 좌우 시력을 구해주세요!


```python
# 1. 실명 데이터 제외

df_vis = df[(df['시력(좌)'] != 9.9) & (df['시력(우)'] != 9.9)]
```


```python
# 2. '연령대', '성별코드'별로 데이터를 그룹화 하여,
#    그룹별 '시력(좌)', '시력(우)' 각각의 평균값 산출

df_vis = df_vis.groupby(['연령대', '성별코드'])[['시력(좌)', '시력(우)']].mean()
df_vis
```




<div>
<style scoped>
    .dataframe tbody tr th:only-of-type {
        vertical-align: middle;
    }

    .dataframe tbody tr th {
        vertical-align: top;
    }

    .dataframe thead th {
        text-align: right;
    }
</style>
<table border="1" class="dataframe">
  <thead>
    <tr style="text-align: right;">
      <th></th>
      <th></th>
      <th>시력(좌)</th>
      <th>시력(우)</th>
    </tr>
    <tr>
      <th>연령대</th>
      <th>성별코드</th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="2" valign="top">20~24세</th>
      <th>1</th>
      <td>1.092213</td>
      <td>1.083185</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.989032</td>
      <td>0.982924</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">25~29세</th>
      <th>1</th>
      <td>1.108857</td>
      <td>1.103328</td>
    </tr>
    <tr>
      <th>2</th>
      <td>1.016270</td>
      <td>1.005915</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">30~34세</th>
      <th>1</th>
      <td>1.116939</td>
      <td>1.112457</td>
    </tr>
    <tr>
      <th>2</th>
      <td>1.029007</td>
      <td>1.021342</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">35~39세</th>
      <th>1</th>
      <td>1.137394</td>
      <td>1.134962</td>
    </tr>
    <tr>
      <th>2</th>
      <td>1.057828</td>
      <td>1.050359</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">40~44세</th>
      <th>1</th>
      <td>1.115274</td>
      <td>1.115097</td>
    </tr>
    <tr>
      <th>2</th>
      <td>1.027355</td>
      <td>1.019675</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">45~49세</th>
      <th>1</th>
      <td>1.052993</td>
      <td>1.053015</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.955158</td>
      <td>0.948959</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">50~54세</th>
      <th>1</th>
      <td>1.002289</td>
      <td>1.001541</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.909823</td>
      <td>0.906133</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">55~59세</th>
      <th>1</th>
      <td>0.954886</td>
      <td>0.956144</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.860990</td>
      <td>0.859704</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">60~64세</th>
      <th>1</th>
      <td>0.880871</td>
      <td>0.885796</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.787723</td>
      <td>0.786190</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">65~69세</th>
      <th>1</th>
      <td>0.805477</td>
      <td>0.806043</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.710150</td>
      <td>0.708960</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">70~74세</th>
      <th>1</th>
      <td>0.735294</td>
      <td>0.739761</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.649616</td>
      <td>0.652478</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">75~79세</th>
      <th>1</th>
      <td>0.658682</td>
      <td>0.664491</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.585486</td>
      <td>0.587602</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">80~84세</th>
      <th>1</th>
      <td>0.598406</td>
      <td>0.603909</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.529401</td>
      <td>0.537303</td>
    </tr>
    <tr>
      <th rowspan="2" valign="top">85세+</th>
      <th>1</th>
      <td>0.517734</td>
      <td>0.523179</td>
    </tr>
    <tr>
      <th>2</th>
      <td>0.424065</td>
      <td>0.433517</td>
    </tr>
  </tbody>
</table>
</div>




```python
# 3. fig, ax = plt.subplots()를 이용해 화면을 분할하고,
#    각 시각화 자료를 그린 뒤, ax=ax[]에 의해 의도하는 화면 위치에 배치

fig, ax = plt.subplots(1, 2, figsize=(15, 7.5))
    # plt.subplots(1, 2) : 행 방향 subplot 수 (1), 열 방향 subplot 수 (2)

sns.barplot(data=df_vis, x='시력(좌)', y='연령대', hue='성별코드', ax=ax[0],
            palette=['#3B9AB2', '#F21A00'])
sns.barplot(data=df_vis, x='시력(우)', y='연령대', hue='성별코드', ax=ax[1],
            palette=['#3B9AB2', '#F21A00'])

plt.show()

```


    
![png](/assets/images/W03_files/W03_22_0.png)
    



```python
# 4. Pointplot으로 시각화 
#    40세를 넘어서는 시점부터 노화함에 따라 양안 모두 시력이 저하되는 경향성을 보여주기에 용이
#    연속적으로 관측된 값이 아니므로 lineplot이 아닌 pointplot으로, 점과 점선으로 표현

fig, ax = plt.subplots(1, 2, figsize=(10, 5))
    # plt.subplots(1, 2) : 행 방향 subplot 수 (1), 열 방향 subplot 수 (2)

sns.pointplot(data=df_vis, y='시력(좌)', x='연령대', hue='성별코드', ax=ax[0],
            palette=['#3B9AB2', '#F21A00'], linestyles=':')
sns.pointplot(data=df_vis, y='시력(우)', x='연령대', hue='성별코드', ax=ax[1],
            palette=['#3B9AB2', '#F21A00'], linestyles=':')

for axs in ax:
    axs.tick_params(axis='x', rotation=90)

plt.show()
```


    
![png](/assets/images/W03_files/W03_23_0.png)
    

