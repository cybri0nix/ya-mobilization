# Веб-приложение для отображения расписания лекций проекта Яндекс Мобилизация 2017
_Написано в качестве тестового задания для поступления в Школу разработки интерфейсов_

[Узнать больше о проекте](https://academy.yandex.ru/events/frontend/shri_msk-2017)


* ### [Демонстрация приложения](https://cybri0nix.github.io/ya-mobilization/ ) 

**ОБРАТИТЕ ВНИМАНИЕ:** В демонстрации, в консоли доступен объект Scheduler (и библиотека для работы со справочниками [YaSchool](https://github.com/cybri0nix/scheduler)). И Vuejs будет перерендеривать данные расписания. Поэтому можно поиграться с библиотекой прямо в консоли, и сразу же увидеть результат. (как работать с библиотекой Scheduler [читайте тут](https://github.com/cybri0nix/scheduler)) 
Приложение берет данные из LocalStorage, но если их там нет (первый запуск), то хранилище заполняется тестовыми данными ([смотреть исходный код](https://github.com/cybri0nix/ya-mobilization/blob/master/assets/js/app.vue.js) переменная testData, а чуть ниже код для заполнения) 


* [Прототип](https://github.com/cybri0nix/ya-mobilization/blob/master/proto/page-schedule-view.png)
* [Исходный код макета на AxureRP](https://github.com/cybri0nix/ya-mobilization/blob/master/proto/main.rp)

* [Библиотека для работы с расписанием](https://github.com/cybri0nix/scheduler)
