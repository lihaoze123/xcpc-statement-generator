#import "@preview/numbly:0.1.0": numbly
#import "@preview/cmarker:0.1.6": render as cmarker-render
#import "@preview/mitex:0.2.6": *

#let md = cmarker-render.with(math: mitex)

#let fonts = (
  serif: ("New Computer Modern Math", "FZShuSong-Z01"),
  sans: ("CMU Sans Serif", "FZHei-B01"),
  kaishu: ("FZKai-Z03",),
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

#let render-problem(problem, statement) = [
  #v(-10pt)
  = #text(font: fonts.sans, size: 20pt)[#problem.display-name]
  #v(10pt)

  #let format = problem.at("format", default: "latex")
  #if format == "latex" {
    mitext(statement.description)
  } else if format == "markdown" {
    md(statement.description)
  } else {
    eval(statement.description, mode: "markup")
  }

  #if statement.at("input", default: none) != none and statement.input != "" [
    == #text(font: fonts.sans, size: 15pt)[输入格式]
    #if format == "latex" {
      mitext(statement.input)
    } else if format == "markdown" {
      md(statement.input)
    } else {
      eval(statement.input, mode: "markup")
    }
  ]

  #if statement.at("output", default: none) != none and statement.output != "" [
    == #text(font: fonts.sans, size: 15pt)[输出格式]
    #if format == "latex" {
      mitext(statement.output)
    } else if format == "markdown" {
      md(statement.output)
    } else {
      eval(statement.output, mode: "markup")
    }
  ]

  #if problem.samples.len() > 0 [
    == #text(font: fonts.sans, size: 15pt)[样例]

    #show raw: set text(font: fonts.mono)
    #figure(
      table(
        columns: (7.2cm, 7.2cm),
        align: (x, y) => if y == 0 { center } else { left },
        stroke: 0.4pt,
        table.header([标准输入], [标准输出]),
        ..problem.samples.map(s => (raw(s.input), raw(s.output))).flatten(),
      ),
    )
  ]

  #if statement.at("notes", default: none) != none and statement.notes != "" [
    == #text(font: fonts.sans, size: 15pt)[提示]
    #if format == "latex" {
      mitext(statement.notes)
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
  enable-titlepage: true,
  enable-header-footer: true,
  enable-problem-list: true,
  doc,
) = {
  set text(lang: "zh", font: fonts.serif)
  set document(title: title, author: author)

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
          #text(size: 12pt, font: fonts.sans)[试题列表]

          #set table(stroke: (x, y) => (
            if y == 0 {
              (top: 0.4pt, left: 0.4pt, right: 0.4pt)
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

          本试题册共 #problems.len() 题，#context counter(page).final().at(0) 页。

          如果您的试题册缺少页面，请立即通知志愿者。
        ],
      )
    }
  }

  // 题面
  {
    set par(first-line-indent: (amount: 2em, all: true), justify: true, spacing: 0.65em)
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
        render-problem(e.problem, e.statement)

        if i < problems.len() - 1 {
          pagebreak()
        }
      }
    }
  }

  doc
}
