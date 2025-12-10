#import "@preview/numbly:0.1.0": numbly
#import "@preview/cmarker:0.1.6": render as cmarker-render
#import "@preview/mitex:0.2.6": *

#let md = cmarker-render.with(math: mitex, scope: (image: (source, alt: none, format: auto) => image(source, alt: alt, format: format)))

#let fonts = (
  serif: ("New Computer Modern Math", "FZShuSong-Z01"),
  sans: ("CMU Sans Serif", "FZHei-B01"),
  kaishu: ("FZKai-Z03",),
  songti-bold: ("New Computer Modern Math", "FZXiaoBiaoSong-B05"),
  mono: ("FiraCode Nerd Font",)
)

#let maketitle(
  title: none,
  subtitle: none,
  author: none,
  date: none,
) = {
  set align(center)
  set par(spacing: 0em)

  if title != none {
    text(2.2em, weight: "bold", font: fonts.sans, title)
    v(1.4em)
  }

  if subtitle != none {
    text(2.2em, weight: "bold", font: fonts.sans, subtitle)
    v(2.4em)
  }

  if author != none {
    text(1.5em, font: fonts.kaishu, author)
    v(1.2em)
  }

  if date != none {
    text(1.3em, date)
  }
}

#let translations = (
  zh: (
    input: "输入格式",
    output: "输出格式",
    examples: "样例",
    note: "提示",
    problem-list: "试题列表",
    stdin: "标准输入",
    stdout: "标准输出",
    problem-set-info: (n, m) => [本试题册共 #n 题，#m 页。],
    missing-warning: "如果您的试题册缺少页面，请立即通知志愿者。",
  ),
  en: (
    input: "Input",
    output: "Output",
    examples: "Examples",
    note: "Note",
    problem-list: "Problem List",
    stdin: "standard input",
    stdout: "standard output",
    problem-set-info: (n, m) => [This problem set should contain #n problems on #m numbered pages.],
    missing-warning: "Please inform a runner immediately if something is missing from your problem set.",
  )
)

#let render-problem(problem, statement, language: "zh") = [
  #v(-10pt)
  = #text(font: fonts.sans, size: 20pt)[#problem.display-name]
  #v(10pt)

  #let format = problem.at("format", default: "latex")
  #if format == "latex" {
    let res = mitex-convert(mode: "text", statement.description)
    eval(res, mode: "markup", scope: mitex-scope)
  } else if format == "markdown" {
    md(statement.description)
  } else {
    eval(statement.description, mode: "markup")
  }
  #v(0.5em)

  #if statement.at("input", default: none) != none and statement.input != "" [
    == #text(font: fonts.sans, size: 15pt)[#translations.at(language).input]
    #if format == "latex" {
      let res = mitex-convert(mode: "text", statement.input)
      eval(res, mode: "markup", scope: mitex-scope)
    } else if format == "markdown" {
      md(statement.input)
    } else {
      eval(statement.input, mode: "markup")
    }
  ]
  #v(0.5em)

  #if statement.at("output", default: none) != none and statement.output != "" [
    == #text(font: fonts.sans, size: 15pt)[#translations.at(language).output]
    #if format == "latex" {
      let res = mitex-convert(mode: "text", statement.output)
      eval(res, mode: "markup", scope: mitex-scope)
    } else if format == "markdown" {
      md(statement.output)
    } else {
      eval(statement.output, mode: "markup")
    }
  ]
  #v(0.5em)

  #if problem.samples.len() > 0 [
    == #text(font: fonts.sans, size: 15pt)[#translations.at(language).examples]

    #figure(
      table(
        columns: (7.2cm, 7.2cm),
        align: (x, y) => if y == 0 { center } else { left },
        stroke: 0.4pt,
        table.header([#translations.at(language).stdin], [#translations.at(language).stdout]),
        ..problem.samples.map(s => (raw(s.input), raw(s.output))).flatten(),
      ),
    )
  ]
  #v(0.5em)

  #if statement.at("notes", default: none) != none and statement.notes != "" [
    == #text(font: fonts.sans, size: 15pt)[#translations.at(language).note]
    #if format == "latex" {
      let res = mitex-convert(mode: "text", statement.notes)
      eval(res, mode: "markup", scope: mitex-scope)
    } else if format == "markdown" {
      md(statement.notes)
    } else {
      eval(statement.notes, mode: "markup")
    }
  ]
]

#let render-problems(problems: none) = {}

#let contest-conf(
  title: "这是一场 XCPC 程序设计竞赛",
  subtitle: "试题册",
  author: "初梦",
  date: datetime.today().display("[year] 年 [month] 月[day] 日"),
  problems: none,
  language: "zh",
  titlepage-language: auto,
  problem-language: auto,
  enable-titlepage: true,
  enable-header-footer: true,
  enable-problem-list: true,
  doc,
) = {
  let titlepage-lang = if titlepage-language == auto { language } else { titlepage-language }
  let problem-lang = if problem-language == auto { language } else { problem-language }
  set text(lang: "zh", font: fonts.serif)
  set document(title: title, author: author)

  show strong: set text(font: fonts.songti-bold, weight: "bold")
  show raw: set text(font: fonts.mono)

  // 封面页
  if enable-titlepage {
    set page(
      margin: (top: 8cm, bottom: 3cm, left: 2.5cm, right: 2.5cm),
    )
    set par(spacing: 0.8em)
    maketitle(title: title, subtitle: subtitle, date: date, author: author)

    // TOC
    if enable-problem-list {
      figure(
        placement: bottom,
        [
          #text(size: 12pt, font: fonts.sans)[#translations.at(titlepage-lang).problem-list]

          #set table(stroke: (x, y) => (
            if y == 0 {
              if problems.len() == 1 {
                (top: 0.4pt, bottom: 0.4pt, left: 0.4pt, right: 0.4pt)
              } else {
                (top: 0.4pt, left: 0.4pt, right: 0.4pt)
              }
            } else if y == problems.len() - 1 {
              (bottom: 0.4pt, left: 0.4pt, right: 0.4pt)
            } else {
              (left: 0.4pt, right: 0.4pt)
            }
          ))

          #table(
            columns: (1.4cm, 6cm),
            align: center,
            // stroke: 0.4pt,
            ..problems.enumerate().map(((i, e)) => (
              str.from-unicode(int(i) + 65), e.problem.display_name
            )).flatten()
          )

          #v(0.8cm)

          #context (translations.at(titlepage-lang).problem-set-info)(problems.len(), counter(page).final().at(0))

          #translations.at(titlepage-lang).missing-warning
        ],
      )
    }
  }

  // 题面
  {
    set par(justify: true, spacing: 0.65em)
    show heading: set block(above: 0.6em)
    show heading: set text(font: fonts.sans)

    set page(
      margin: (top: 3cm, bottom: 2.5cm, x: 2.5cm),
      header: if enable-header-footer {
        [
          #set text(size: 10pt)
          #grid(
            columns: (1fr, 1fr),
            align: (left, right),
            [#title], [#date],
          )
          #v(-0.1cm)
          #line(length: 100%, stroke: 0.5pt)
        ]
      },
      footer: if enable-header-footer {
        context [
          #set align(center)
          #line(length: 100%, stroke: 0.5pt)
          #set text(font: fonts.sans)
          #counter(page).display(
            numbly("{1}", { "Page {1} of {2}" }),
            both: true,
          )
        ]
      },
    )

    counter(page).update(1)

    if problems != none {
      for (i, e) in problems.enumerate() {
        e.problem.display-name = "Problem " + str.from-unicode(int(i) + 65) + ". " + e.problem.display_name
        render-problem(e.problem, e.statement, language: problem-lang)

        if i < problems.len() - 1 {
          pagebreak()
        }
      }
    }
  }

  doc
}
