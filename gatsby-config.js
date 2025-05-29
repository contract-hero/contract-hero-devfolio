module.exports = {
  siteMetadata: {
    // Site URL for when it goes live
    siteUrl: `https://contracthero.dev/`,
    // Your Name
    name: 'Álvaro Lillo Igualada | Contract Hero',
    // Main Site Title
    title: `Contract Hero | Smart Contract development and audit`,
    // Description that goes under your name in main bio
    description: `Your smart contracts are at risk. They need the right hero.`,
    // Optional: Twitter account handle
    author: `@alilloig`,
    // Optional: Github account URL
    github: `https://github.com/alilloig`,
    // Optional: LinkedIn account URL
    linkedin: `https://www.linkedin.com/in/alvaro-lillo-igualada/`,
    // Content of the About Me section
    about: `Smart Contract Engineer | Move and Cadence`,
    // Optional: List your projects, they must have `name` and `description`. `link` is optional.
    projects: [
      {
        name: 'Trade Wars',
        description:
          'Trade Wars is the fully on-chain, massively multiplayer, interplanetary trading game set in a post-apocalyptic future — produce, trade, and expand your reach among the stars.',
        link: 'https://tradewars.space',
      },
      {
        name: 'Band Oracle Cadence Smart Contracts',
        description:
          'Contracts supporting Band protocol Oracle Network on Flow blockchain.',
        link: 'https://github.com/onflow/band-oracle-contracts',
      },
      {
        name: 'Celer Cadence Smart Contracts',
        description:
          'Contracts supporting Celer Network (cBridge) on Flow blockchain.',
        link: 'https://github.com/alilloig/celer-contracts',
      },
    ],
    // Optional: List your experience, they must have `name` and `description`. `link` is optional.
    experience: [
      {
        name: 'Freelance',
        description: 'Smart Contract Engineer, July 2023 - Present',
        link: 'https://github.com/alilloig',
      },
      {
        name: 'Dapper Labs',
        description: 'Smart Contract Engineer,  May 2022 - February 2023',
        link: 'https://www.dapperlabs.com/',
      },
    ],
    // Optional: List your skills, they must have `name` and `description`.
    skills: [
      {
        name: 'Smart Contract Development',
        description:
          'Move, Cadence',
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
