module.exports = {
  siteMetadata: {
    // Site URL for when it goes live
    siteUrl: `https://contracthero.dev/`,
    // Your Name
    name: 'Álvaro Lillo Igualada | Solutions Engineer at Sui Foundation',
    // Main Site Title
    title: `Contract Hero | Solutions Engineer at Sui Foundation`,
    // Description that goes under your name in main bio
    description: `Growing the Move developer ecosystem through education, technical content, and DeFi infrastructure support.`,
    // Optional: Twitter account handle
    author: `TheContractHero`,
    // Optional: Github account URL
    github: `https://github.com/alilloig`,
    // Optional: LinkedIn account URL
    linkedin: `https://www.linkedin.com/in/alilloig/`,
    // Content of the About Me section
    about: `Solutions Engineer at the Sui Foundation, focused on growing the Move developer ecosystem through hands-on bootcamps across Europe, educational content creation, and DeFi infrastructure support. Previously a smart contract engineer building on Flow (Cadence) and Sui (Move), with experience spanning oracle integrations, cross-chain bridges, and fully on-chain games. Before blockchain, spent four years as a lead teacher at technical colleges in Spain, teaching software development, networking, and systems administration — and before that, worked as a full-stack developer at the Spanish Stock Exchange.`,
    // Optional: List your projects, they must have `name` and `description`. `link` is optional.
    projects: [
      {
        name: 'Sui Move Bootcamps',
        description:
          'Leading in-person developer bootcamps across Europe for the Sui Foundation — training 70+ builders in Bucharest and Paris to build production-ready dApps on Sui.',
        link: 'https://x.com/TheContractHero',
      },
      {
        name: 'Trade Wars',
        description:
          'A fully on-chain, massively multiplayer, interplanetary trading game built on Sui — produce, trade, and expand your reach among the stars.',
        link: 'https://tradewars.space',
      },
      {
        name: 'Band Oracle Cadence Smart Contracts',
        description:
          'Ported Band Protocol oracle contracts from Solidity to Cadence on Flow blockchain.',
        link: 'https://github.com/onflow/band-oracle-contracts',
      },
      {
        name: 'Celer Cadence Smart Contracts',
        description:
          'Upgraded Celer Network cBridge contracts to Cadence 1.0 on Flow. Audited by Oak Security.',
        link: 'https://github.com/alilloig/celer-contracts',
      },
    ],
    // Optional: List your experience, they must have `name` and `description`. `link` is optional.
    experience: [
      {
        name: 'Sui Foundation',
        description: 'Solutions Engineer, October 2025 - Present',
        link: 'https://sui.io',
      },
      {
        name: 'Freelance',
        description: 'Smart Contract Engineer, September 2023 - September 2025',
        link: 'https://github.com/alilloig',
      },
      {
        name: 'Dapper Labs',
        description: 'Smart Contract Engineer, May 2022 - February 2023',
        link: 'https://www.dapperlabs.com/',
      },
      {
        name: 'Department of Education, Spain',
        description: 'Technical College Lead Teacher, 2017 - 2021. Taught software development, networking, and systems administration to vocational education students across Madrid and Valencia.',
        link: '',
      },
      {
        name: 'Bolsas y Mercados Españoles (Spanish Stock Exchange)',
        description: 'Full-Stack Developer, 2014 - 2017. Technical support for a B2B electronic trading platform, optimizing FIX-based transaction processing.',
        link: '',
      },
    ],
    // Optional: List your skills, they must have `name` and `description`.
    skills: [
      {
        name: 'Smart Contract Development',
        description:
          'Move (Sui), Cadence (Flow)',
      },
      {
        name: 'Sui Ecosystem',
        description:
          'Sui SDK, Sui CLI, DeepBook, On-chain Primitives',
      },
      {
        name: 'Languages & Tools',
        description:
          'TypeScript, Git, Node.js',
      },
      {
        name: 'Developer Education',
        description:
          'Bootcamp Instruction, Technical Writing, Learning Materials',
      },
    ],
  },
  plugins: [
    `gatsby-plugin-react-helmet`,
    `gatsby-plugin-image`,
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `images`,
        path: `${__dirname}/src/images`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        path: `${__dirname}/content/blog`,
        name: `blog`,
      },
    },
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        plugins: [
          {
            resolve: `gatsby-remark-images`,
            options: {
              maxWidth: 590,
              wrapperStyle: `margin: 0 0 30px;`,
            },
          },
          {
            resolve: `gatsby-remark-responsive-iframe`,
            options: {
              wrapperStyle: `margin-bottom: 1.0725rem`,
            },
          },
          `gatsby-remark-prismjs`,
          `gatsby-remark-copy-linked-files`,
          `gatsby-remark-smartypants`,
        ],
      },
    },
    {
      resolve: `gatsby-plugin-sharp`,
      options: {
        defaults: {
          formats: [`auto`, `webp`],
          placeholder: `dominantColor`,
          quality: 80,
        },
      },
    },
    `gatsby-transformer-sharp`,
    `gatsby-plugin-postcss`,
    {
      resolve: `gatsby-plugin-feed`,
      options: {
        query: `
          {
            site {
              siteMetadata {
                title
                description
                siteUrl
                site_url: siteUrl
              }
            }
          }
        `,
        feeds: [
          {
            serialize: ({ query: { site, allMarkdownRemark } }) => {
              return allMarkdownRemark.edges.map((edge) => {
                return Object.assign({}, edge.node.frontmatter, {
                  description: edge.node.excerpt,
                  date: edge.node.frontmatter.date,
                  url: site.siteMetadata.siteUrl + edge.node.fields.slug,
                  guid: site.siteMetadata.siteUrl + edge.node.fields.slug,
                  custom_elements: [{ 'content:encoded': edge.node.html }],
                });
              });
            },
            query: `
              {
                allMarkdownRemark(
                  sort: { frontmatter: { date: DESC } }
                ) {
                  edges {
                    node {
                      excerpt
                      html
                      fields { slug }
                      frontmatter {
                        title
                        date
                      }
                    }
                  }
                }
              }
            `,
            output: '/rss.xml',
            title: "Your Site's RSS Feed",
          },
        ],
      },
    },
    {
      resolve: `gatsby-plugin-google-analytics`,
      options: {
        trackingId: `ADD YOUR TRACKING ID HERE`, // Optional Google Analytics
      },
    },
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `devfolio`,
        short_name: `devfolio`,
        start_url: `/`,
        background_color: `#663399`,
        theme_color: `#663399`, // This color appears on mobile
        display: `minimal-ui`,
        icon: `src/images/icon.png`,
      },
    },
  ],
};
